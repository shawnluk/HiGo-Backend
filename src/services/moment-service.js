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

/**
 * 分页查询动态（moment）帖子列表，并补充每个帖子的图片、点赞人、评论。
 * 支持 keyword/q（模糊匹配 name、activity_title、content）过滤，以及 offset/limit 分页
 * （limit 缺省或非法时为 1000）。先查询主帖，再并行按帖子 ID 批量查询图片、点赞、评论，
 * 分类聚合后按顺序组装进每个帖子的返回结构。
 * @param {Object} [query] 查询参数，可选 keyword（或 q）、offset（起始偏移，默认 0）、
 *   limit（每页条数，默认 1000）。
 * @returns {Promise<Array<Object>>}
 *   返回结构：帖子对象数组，每项含 id、name、avatar、activityTitle、content、images、
 *   time、likeCount、likes（点赞用户名数组）、comments（评论 {user, text} 数组）。
 *   无结果时返回空数组。
 * @throws 无显式异常。
 */
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