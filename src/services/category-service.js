import { getPool } from '../lib/db.js';
import { LIST_CATEGORIES } from '../db/queries.js';

export async function listCategories() {
  const pool = getPool();
  const [rows] = await pool.query(LIST_CATEGORIES);
  return rows;
}

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