import { getPool } from '../lib/db.js';
import {
  FIND_USER_BY_ID,
  FIND_USER_BY_PHONE,
  FIND_USER_PASSWORD_BY_ID,
  FIND_USER_PROFILE_BY_ID,
  UPDATE_USER_PASSWORD,
  UPDATE_USER_PHONE,
  UPDATE_USER_PROFILE,
} from '../db/queries.js';

// 密码规则：与注册保持一致，长度 6-10 位，仅允许中文、大小写字母、数字及下划线、连字符
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 10;
const PASSWORD_PATTERN = /^[\u4e00-\u9fa5A-Za-z0-9_-]+$/;

// gender 取值：0=保密/未知, 1=男, 2=女
const GENDER_VALUES = [0, 1, 2];

// 头像校验：http/https URL，最长 500 字符（与 avatar VARCHAR(500) 对齐）
const AVATAR_MAX_LENGTH = 500;

// 允许用户自助更新的 user_profiles 字段：请求字段名 → 数据库列名
// 注意：real_name（实名认证）、user_type / user_status / is_deleted / user_no / identity_card
// 等字段属于系统或管理员维护，不在用户可改范围内。
const PROFILE_FIELDS = {
  nickname: 'nickname',
  avatar: 'avatar',
  birthday: 'birthday',
  gender: 'gender',
};

function toPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function isEnumValue(value, allowed) {
  const n = Number(value);
  return Number.isInteger(n) && allowed.includes(n);
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 更新当前用户的账号与资料信息（手机号、昵称、头像、生日、性别）。
 * 支持按需部分更新：仅处理请求体中出现的字段，未出现的字段保持不变。
 * @param {number|string} userId 目标用户 ID（通常来自 token 的 req.user.sub）。
 * @param {Object} [payload] 可更新字段：
 *  - phone {string} 手机号，非空时需符合 1[3-9]xxxxxxxxx 且不与其它账号冲突
 *  - nickname {string} 昵称（非空）
 *  - avatar {string} 头像（URL 或 base64 图片数据，见 AVATAR 校验规则）
 *  - birthday {string} 生日，格式 YYYY-MM-DD，可空
 *  - gender {number|string} 性别，取值 0=保密/未知、1=男、2=女
 * @returns {Promise<{user_id: number, phone: string, profile: Object}>} 更新后的账号与资料。
 * @throws {Error} 400（参数非法）/ 401（未登录）/ 409（手机号已被占用）。
 */
export async function updateProfile(userId, payload = {}) {
  const id = toPositiveInt(userId, 0);
  if (!id) {
    const error = new Error('请先登录');
    error.statusCode = 401;
    throw error;
  }

  const pool = getPool();

  // 手机号位于 users 表，单独处理：格式校验 + 查重（排除自身）
  if (payload.phone !== undefined) {
    const phone = String(payload.phone || '').trim();
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      const error = new Error('手机号格式不正确');
      error.statusCode = 400;
      throw error;
    }
    if (phone) {
      const [rows] = await pool.query(FIND_USER_BY_PHONE, [phone]);
      if (rows.some((row) => Number(row.user_id) !== id)) {
        const error = new Error('手机号已被其他账号使用');
        error.statusCode = 409;
        throw error;
      }
    }
    await pool.query(UPDATE_USER_PHONE, [phone, id]);
  }

  // 资料字段位于 user_profiles 表，动态拼装 SET 子句做部分更新
  const setParts = [];
  const setParams = [];
  for (const [field, column] of Object.entries(PROFILE_FIELDS)) {
    if (payload[field] === undefined) continue;
    const value = payload[field];

    if (field === 'gender') {
      if (value !== null && value !== '' && !isEnumValue(value, GENDER_VALUES)) {
        const error = new Error('性别取值应为 0/1/2');
        error.statusCode = 400;
        throw error;
      }
      setParts.push(`${column} = ?`);
      setParams.push(value === '' || value === null ? null : Number(value));
      continue;
    }

    if (field === 'birthday') {
      const birthday = String(value || '').trim();
      if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
        const error = new Error('生日格式应为 YYYY-MM-DD');
        error.statusCode = 400;
        throw error;
      }
      setParts.push(`${column} = ?`);
      setParams.push(birthday || null);
      continue;
    }

    if (field === 'avatar') {
      const avatar = String(value ?? '').trim();
      if (avatar) {
        if (avatar.length > AVATAR_MAX_LENGTH) {
          const error = new Error(`头像地址过长（最多 ${AVATAR_MAX_LENGTH} 字符）`);
          error.statusCode = 400;
          throw error;
        }
        if (!isValidHttpUrl(avatar)) {
          const error = new Error('头像必须是有效的 http/https URL');
          error.statusCode = 400;
          throw error;
        }
      }
      setParts.push(`${column} = ?`);
      setParams.push(avatar);
      continue;
    }

    const text = String(value ?? '').trim();
    if (field === 'nickname' && !text) {
      const error = new Error('昵称不能为空');
      error.statusCode = 400;
      throw error;
    }
    setParts.push(`${column} = ?`);
    setParams.push(text);
  }

  if (setParts.length) {
    const sql = UPDATE_USER_PROFILE.replace('{{set}}', setParts.join(', '));
    await pool.query(sql, [...setParams, id]);
  }

  // 返回更新后的账号信息与完整资料
  const [users] = await pool.query(FIND_USER_BY_ID, [id]);
  const [profiles] = await pool.query(FIND_USER_PROFILE_BY_ID, [id]);

  return {
    user_id: id,
    phone: users[0]?.phone ?? '',
    profile: profiles[0] || {},
  };
}

/**
 * 修改密码：校验旧密码正确后写入新密码。
 * @param {number|string} userId 目标用户 ID（通常来自 token 的 req.user.sub）。
 * @param {Object} [payload] 改密参数：
 *  - old_password {string} 旧密码，必填
 *  - new_password {string} 新密码，必填，规则与注册一致（6-10 位，仅中文/字母/数字/下划线/连字符）
 * @returns {Promise<{user_id: number, updated: boolean}>} 修改结果。
 * @throws {Error} 400（参数缺失 / 新密码不合法 / 旧密码错误）/ 401（未登录）。
 */
export async function changePassword(userId, payload = {}) {
  const id = toPositiveInt(userId, 0);
  if (!id) {
    const error = new Error('请先登录');
    error.statusCode = 401;
    throw error;
  }

  const oldPassword = String(payload.old_password ?? '').trim();
  const newPassword = String(payload.new_password ?? '').trim();

  if (!oldPassword || !newPassword) {
    const error = new Error('旧密码与新密码均为必填');
    error.statusCode = 400;
    throw error;
  }
  if (newPassword.length < PASSWORD_MIN_LENGTH || newPassword.length > PASSWORD_MAX_LENGTH) {
    const error = new Error(`密码长度需为 ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} 位`);
    error.statusCode = 400;
    throw error;
  }
  if (!PASSWORD_PATTERN.test(newPassword)) {
    const error = new Error('密码只能包含中文、字母、数字、下划线和连字符');
    error.statusCode = 400;
    throw error;
  }

  const pool = getPool();
  const [rows] = await pool.query(FIND_USER_PASSWORD_BY_ID, [id]);
  if (!rows.length || rows[0].password_hash !== oldPassword) {
    const error = new Error('旧密码不正确');
    error.statusCode = 400;
    throw error;
  }

  await pool.query(UPDATE_USER_PASSWORD, [newPassword, id]);

  return { user_id: id, updated: true };
}
