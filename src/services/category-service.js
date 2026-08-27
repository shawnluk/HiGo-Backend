import { getPool } from '../lib/db.js';
import { LIST_CATEGORIES } from '../db/queries.js';

export async function listCategories() {
  const pool = getPool();
  const [rows] = await pool.query(LIST_CATEGORIES);
  return rows;
}

/**
 * 根据分类 ID 查询单个活动分类。
 * 将传入的 categoryId 转为数字（无效值按 0 处理），按主键查询对应分类；
 * 若不存在该分类则抛出异常，否则返回分类对象。
 * @param {number|string} categoryId 活动分类 ID。
 * @returns {Promise<{category_id: number, category_name: string}>}
 *   返回结构：含 category_id 与 category_name 的分类对象。
 * @throws {Error} 状态码 400（分类 ID 无效，即查无此分类）。
 */
export async function getCategoryById(categoryId) {
  const id = Number(categoryId) || 0;
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT category_id, category_name FROM activity_categories WHERE category_id = ?',
    [id],
  );
  if (!rows.length) {
    const error = new Error(`Invalid category_id: ${id}`);
    error.statusCode = 400;
    throw error;
  }
  return rows[0];
}