import { getPool } from '../lib/db.js';
import { signToken, makeTokenPayload } from '../lib/token.js';
import {
  FIND_USER_BY_USERNAME,
  FIND_USER_PROFILE_BY_ID,
  INSERT_USER,
  INSERT_USER_PROFILE,
} from '../db/queries.js';
import { listMySquads, countActivitiesBySquads } from './squad-service.js';

// function hashPassword(password, salt) {
//   const s = salt || crypto.randomBytes(16).toString('hex');
//   const hash = crypto
//     .pbkdf2Sync(password, s, 100000, 64, 'sha512')
//     .toString('hex');
//   return `${s}:${hash}`;
// }

// function verifyPassword(password, stored) {
//   const [salt] = stored.split(':');
//   return hashPassword(password, salt) === stored;
// }

/**
 * 用户注册。
 * 校验用户名非空、密码长度不少于 6 位，并检查用户名是否已存在，均通过后写入用户及其资料记录，
 * 最后签发 JWT 令牌。
 * @param {Object} payload 注册参数，包含 username（用户名）、password（密码），
 *   可选 nickname（昵称，缺省时沿用用户名）、avatar（头像地址）。
 * @param {Object} config 应用配置，需包含 jwtSecret 用于签发令牌。
 * @returns {Promise<{token: string, user_id: number, username: string, nickname: string}>}
 *   返回结构：token（JWT）、user_id（新用户 ID）、username、nickname。
 * @throws {Error} 状态码 400（username 缺失 / 密码长度不足）、409（用户名已存在）。
 */
export async function register(payload, config) {
  const username = String(payload.username || '').trim();
  const password = String(payload.password || '').trim();

  if (!username) {
    const error = new Error('Username is required');
    error.statusCode = 400;
    throw error;
  }
  if (password.length < 6) {
    const error = new Error('Password must be at least 6 characters');
    error.statusCode = 400;
    throw error;
  }

  const pool = getPool();

  const [existing] = await pool.query(FIND_USER_BY_USERNAME, [username]);
  if (existing.length) {
    const error = new Error('Username already exists');
    error.statusCode = 409;
    throw error;
  }

  const nickname = String(payload.nickname || username).trim();
  const avatar = String(payload.avatar || '').trim();

  const [result] = await pool.query(INSERT_USER, [username, password]);
  const userId = result.insertId;

  await pool.query(INSERT_USER_PROFILE, [userId, nickname, avatar]);

  const token = signToken(
    makeTokenPayload(userId, { username, nickname }),
    config.jwtSecret,
  );

  return { token, user_id: userId, username, nickname };
}

/**
 * 用户登录。
 * 校验用户名与密码均非空，按用户名查询用户并比对密码哈希，成功后加载用户资料并
 * 顺带查询其已加入的小队信息（含各小队活动总数），最后签发 JWT 令牌。
 * 小队查询失败时不阻断登录，仅记录错误日志。
 * @param {Object} credentials 登录凭据，包含 username 与 password。
 * @param {Object} config 应用配置，需包含 jwtSecret 用于签发令牌。
 * @returns {Promise<{token: string, user_id: number, username: string, profile: Object, squads: Array}>}
 *   返回结构：token（JWT）、user_id、username、profile（用户资料，可能为空对象）、
 *   squads（用户加入的小队数组，每项含 activity_count 活动总数）。
 * @throws {Error} 状态码 400（用户名或密码缺失）、401（用户名或密码错误）。
 */
export async function login(credentials, config) {
  console.log(credentials);
  const username = String(credentials.username || '').trim();
  const password = String(credentials.password || '').trim();

  if (!username || !password) {
    const error = new Error('Username and password are required');
    error.statusCode = 400;
    throw error;
  }

  const pool = getPool();
  const [rows] = await pool.query(FIND_USER_BY_USERNAME, [username]);

  if (!rows.length || rows[0].password_hash !== password) {
    const error = new Error('Invalid username or password');
    error.statusCode = 401;
    throw error;
  }

  const user = rows[0];
  const [profiles] = await pool.query(FIND_USER_PROFILE_BY_ID, [user.user_id]);
  const profile = profiles[0] || {};

  const token = signToken(
    makeTokenPayload(user.user_id, { username: user.username }),
    config.jwtSecret,
  );

  // 顺带查询该用户已加入的小队，返回给前端
  let squads = [];
  try {
    squads = await listMySquads(user.user_id);
    // 按小队ID统计各小队活动总数，合并进每个小队
    if (squads.length) {
      const counts = await countActivitiesBySquads(squads.map((s) => s.squad_id));
      squads = squads.map((s) => ({ ...s, activity_count: counts[s.squad_id] || 0 }));
    }
  } catch (error) {
    // 小队表尚未初始化时不阻断登录
    console.error('load user squads on login failed:', error.message);
  }

  return { token, user_id: user.user_id, username: user.username, profile, squads };
}