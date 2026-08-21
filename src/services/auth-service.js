import { getPool } from '../lib/db.js';
import { signToken, makeTokenPayload } from '../lib/token.js';
import {
  FIND_USER_BY_USERNAME,
  FIND_USER_PROFILE_BY_ID,
  INSERT_USER,
  INSERT_USER_PROFILE,
} from '../db/queries.js';

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

  return { token, user_id: user.user_id, username: user.username, profile };
}