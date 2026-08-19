import { getPool } from '../lib/db.js';
import {
  LIST_MOMENT_POSTS,
  BATCH_POST_IMAGES,
  BATCH_POST_LIKES,
  BATCH_POST_COMMENTS,
} from '../db/queries.js';

function mapMomentPost(row, images, likes, comments) {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    activityTitle: row.activity_title,
    content: row.content,
    images,
    time: row.time,
    likeCount: row.like_count,
    likes,
    comments,
  };
}

export async function listMomentPosts(query = {}) {
  const pool = getPool();
  const conditions = [];
  const params = [];

  const keyword = String(query.keyword || query.q || '').trim().toLowerCase();
  if (keyword) {
    conditions.push('(name LIKE ? OR activity_title LIKE ? OR content LIKE ?)');
    const likePattern = `%${keyword}%`;
    params.push(likePattern, likePattern, likePattern);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = Math.max(Number(query.offset) || 0, 0);
  const limit = Number(query.limit) > 0 ? Number(query.limit) : 1000;

  const sql = LIST_MOMENT_POSTS.replace('{{where}}', where);
  const [rows] = await pool.query(sql, [...params, limit, offset]);

  if (!rows.length) return [];

  const postIds = rows.map((r) => r.id);

  const [imageRows, likeRows, commentRows] = await Promise.all([
    pool.query(BATCH_POST_IMAGES, [postIds]),
    pool.query(BATCH_POST_LIKES, [postIds]),
    pool.query(BATCH_POST_COMMENTS, [postIds]),
  ]);

  const imagesByPost = {};
  for (const r of imageRows[0]) {
    (imagesByPost[r.post_id] ||= []).push(r.image_url);
  }

  const likesByPost = {};
  for (const r of likeRows[0]) {
    (likesByPost[r.post_id] ||= []).push(r.username);
  }

  const commentsByPost = {};
  for (const r of commentRows[0]) {
    (commentsByPost[r.post_id] ||= []).push({ user: r.user, text: r.text });
  }

  return rows.map((row) =>
    mapMomentPost(
      row,
      imagesByPost[row.id] || [],
      likesByPost[row.id] || [],
      commentsByPost[row.id] || [],
    ),
  );
}