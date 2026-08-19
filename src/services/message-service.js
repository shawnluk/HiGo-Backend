import { getPool } from '../lib/db.js';
import { LIST_MESSAGES } from '../db/queries.js';

function mapMessage(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    time: row.time,
    read: Boolean(row.is_read),
  };
}

export async function listMessages(query = {}) {
  const pool = getPool();
  const conditions = [];
  const params = [];

  if (query.read !== undefined) {
    conditions.push('is_read = ?');
    params.push(String(query.read) === 'true' || String(query.read) === '1' ? 1 : 0);
  }

  if (query.type) {
    conditions.push('type = ?');
    params.push(query.type);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = LIST_MESSAGES.replace('{{where}}', where);
  const [rows] = await pool.query(sql, params);

  return rows.map(mapMessage);
}