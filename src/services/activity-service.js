import { getPool } from '../lib/db.js';
import { LIST_ACTIVITIES, INSERT_ACTIVITY, LIST_CATEGORIES } from '../db/queries.js';

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
    tag_text: row.tag_text,
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

  if (query.tagText) {
    conditions.push('tag_text = ?');
    params.push(query.tagText);
  }

  const keyword = String(query.keyword || query.q || '').trim().toLowerCase();
  if (keyword) {
    conditions.push('(title LIKE ? OR location_text LIKE ? OR org_name LIKE ? OR tag_text LIKE ?)');
    const likePattern = `%${keyword}%`;
    params.push(likePattern, likePattern, likePattern, likePattern);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = Math.max(Number(query.offset) || 0, 0);
  const limit = toPositiveInt(query.limit, 1000);

  const sql = LIST_ACTIVITIES.replace('{{where}}', where);
  const [rows] = await pool.query(sql, [...params, limit, offset]);

  return rows.map(mapActivity);
}

export async function listCategories() {
  const pool = getPool();
  const [rows] = await pool.query(LIST_CATEGORIES);
  // console.log(rows);
  return rows;
}

export async function createActivity(payload = {}) {
  const title = String(payload.title || '').trim();
  if (!title) {
    const error = new Error('Activity title is required');
    error.statusCode = 400;
    throw error;
  }

  const categoryId = Number(payload.category_id) || 0;
  const pool = getPool();

  const [categories] = await pool.query('SELECT category_id, tag_text FROM activity_categories WHERE category_id = ?', [categoryId]);
  const category = categories[0];
  if (!category) {
    const error = new Error(`Invalid category_id: ${categoryId}`);
    error.statusCode = 400;
    throw error;
  }

  const cover =
    String(payload.cover || '').trim() ||
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80';

  const location_text = String(payload.location || payload.location_text || '').trim() || '待定';
  const time_text = normalizeTime(payload.time || payload.time_text);
  const fee_note = payload.fee_note || buildFeeNote(payload.price);
  const description = String(payload.description || '').trim();
  const org_avatar = payload.org_avatar || `${COS_TEST}/logo.png`;
  const org_name = payload.org_name || 'UnitOne 用户';
  const creator_id = Number(payload.creator_id) || 0;

  const [result] = await pool.query(INSERT_ACTIVITY, [
    category.category_id,
    category.tag_text,
    cover,
    title,
    location_text,
    time_text,
    fee_note,
    description,
    org_avatar,
    org_name,
    creator_id,
  ]);

  return {
    activity_id: result.insertId,
    category_id: category.category_id,
    title,
    cover,
    tag_text: category.tag_text,
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