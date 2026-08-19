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

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function descriptionToParagraphs(description, title) {
  const text = stripHtml(description);
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length) return lines;
  return [
    `欢迎参加「${title}」。`,
    '具体流程与注意事项以后续主办方通知为准。',
  ];
}

function buildFeeNote(price) {
  const raw = String(price ?? '').trim();
  if (!raw || Number(raw) === 0) return '免费';
  return `费用 ¥${raw}/人`;
}

function mapActivity(row) {
  // console.log(row);
  return {
    activity_id: row.activity_id,
    category_id: row.category_id,
    isActive: Boolean(row.is_active),
    tagText: row.tag_text,
    cover: row.cover,
    title: row.title,
    location_text: row.location_text,
    time_text: row.time_text,
    fee_note: row.fee_note,
    org_avatar: row.org_avatar,
    org_name: row.org_name,
    joinCount: row.join_count,
    detail_paragraphs: row.detail_paragraphs || [],
    joinAvatars: row.join_avatars || [],
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
  const org_avatar = payload.org_avatar || `${COS_TEST}/logo.png`;
  const org_name = payload.org_name || 'UnitOne 用户';
  const detail_paragraphs = descriptionToParagraphs(payload.description, title);

  const [result] = await pool.query(INSERT_ACTIVITY, [
    category.category_id,
    category.tag_text,
    cover,
    title,
    location_text,
    time_text,
    fee_note,
    org_avatar,
    org_name,
    JSON.stringify(detail_paragraphs),
    JSON.stringify([]),
  ]);

  return {
    id: result.insertId,
    category_id: category.category_id,
    isActive: false,
    tagText: category.tag_text,
    cover,
    title,
    location_text,
    time_text,
    fee_note,
    detail_paragraphs,
    org_avatar,
    org_name,
    joinCount: 0,
    joinAvatars: [],
    createdAt: new Date().toISOString(),
  };
}