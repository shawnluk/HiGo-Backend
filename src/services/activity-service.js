import { getPool } from '../lib/db.js';
import { LIST_ACTIVITIES, INSERT_ACTIVITY } from '../db/queries.js';
import { getCategoryById } from './category-service.js';

const COS_TEST = 'https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test';

function toPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function normalizeTime(value) {
  const str = String(value || '').trim();
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(str)) return `${str}:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) return str.replace('T', ' ');
  return str;
}

function buildFeeNote(price) {
  const raw = String(price ?? '').trim();
  if (!raw || Number(raw) === 0) return '免费';
  return `费用 ¥${raw}/人`;
}

function mapActivity(row) {
  return {
    activity_id: row.activity_id,
    category_id: row.category_id,
    title: row.title,
    cover: row.cover,
    category_name: row.category_name,
    location_text: row.location_text,
    time_text: row.time_text,
    fee_note: row.fee_note,
    description: row.description,
    org_avatar: row.org_avatar,
    org_name: row.org_name,
    creator_id: row.creator_id,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listActivities(query = {}) {
  const pool = getPool();
  const conditions = [];
  const params = [];

  const categoryId = query.category_id || query.categoryId;
  if (categoryId) {
    conditions.push('category_id = ?');
    params.push(Number(categoryId));
  }

  if (query.category_name) {
    conditions.push('category_name = ?');
    params.push(query.category_name);
  }

  const keyword = String(query.keyword || query.q || '').trim().toLowerCase();
  if (keyword) {
    conditions.push('(title LIKE ? OR location_text LIKE ? OR org_name LIKE ? OR category_name LIKE ?)');
    const likePattern = `%${keyword}%`;
    params.push(likePattern, likePattern, likePattern, likePattern);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = Math.max(Number(query.offset) || 0, 0);
  const limit = toPositiveInt(query.limit, 10);

  const countSql = `SELECT COUNT(*) AS total FROM activities ${where}`;
  const [[{ total }]] = await pool.query(countSql, params);

  const sql = LIST_ACTIVITIES.replace('{{where}}', where);
  const [rows] = await pool.query(sql, [...params, limit, offset]);
  
  // console.log(rows);

  return {
    items: rows.map(mapActivity),
    total,
    hasMore: offset + limit < total,
  };
}

export async function createActivity(payload = {}, user = {}) {
  console.log(payload);
  console.log(user);
  const title = String(payload.title || '').trim();
  if (!title) {
    const error = new Error('Activity title is required');
    error.statusCode = 400;
    throw error;
  }

  const category = await getCategoryById(payload.category_id);

  const cover =
    String(payload.cover || '').trim() ||
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80';

  const location_text = String(payload.location || payload.location_text || '').trim() || '待定';
  const time_text = normalizeTime(payload.time || payload.time_text);
  const fee_note = payload.fee_note || buildFeeNote(payload.price);
  const description = String(payload.description || '').trim();
  const org_avatar = payload.org_avatar || `${COS_TEST}/logo.png`;
  const org_name = payload.org_name || 'UnitOne 用户';
  const creator_id = Number(user.sub) || 0;

  // const [result] = await pool.query(INSERT_ACTIVITY, [
  //   category.category_id,
  //   category.category_name,
  //   cover,
  //   title,
  //   location_text,
  //   time_text,
  //   fee_note,
  //   description,
  //   org_avatar,
  //   org_name,
  //   creator_id,
  // ]);
  console.log(creator_id);
  return {
    activity_id: result.insertId,
    category_id: category.category_id,
    title,
    cover,
    category_name: category.category_name,
    location_text,
    time_text,
    fee_note,
    description,
    org_avatar,
    org_name,
    creator_id,
    status: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}