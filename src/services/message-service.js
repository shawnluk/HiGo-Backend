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

/**
 * 按筛选条件查询消息列表。
 * 依据 query 中可能存在的 read（已读/未读，true/1 视为已读）与 type（消息类型）
 * 动态拼接 WHERE 条件，查询后将每行消息映射为统一的对外结构。
 * @param {Object} [query] 查询参数，可选 read（布尔字符串）与 type。
 * @returns {Promise<Array<{id: number, type: string, title: string, content: string, time: string, read: boolean}>>}
 *   返回结构：消息对象数组，read 由数据库 is_read 字段转为布尔值。
 * @throws 无显式异常。
 */
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