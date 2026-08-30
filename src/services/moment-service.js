import { getPool } from '../lib/db.js';
import {
  BATCH_POST_COMMENTS,
  BATCH_POST_IMAGES,
  BATCH_POST_LIKES,
  DELETE_MOMENT_COMMENT,
  DELETE_MOMENT_LIKE,
  DELETE_MOMENT_POST,
  FIND_MOMENT_COMMENT_BY_ID,
  FIND_MOMENT_LIKE,
  FIND_MOMENT_POST_BY_ID,
  INSERT_MOMENT_COMMENT,
  INSERT_MOMENT_IMAGE,
  INSERT_MOMENT_LIKE,
  INSERT_MOMENT_POST,
  LIST_MOMENT_POSTS,
} from '../db/queries.js';

/**
 * 将数据库时间转为「刚刚 / N 分钟前 / N 小时前 / N 天前 / N 个月前 / N 年前」的相对时间。
 * @param {string|Date} date 数据库返回的 created_at
 * @returns {string} 相对时间文案；无法解析时返回空串
 */
function toRelativeTime(date) {
  if (!date) return '';
  const diffSec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diffSec < 60) return '刚刚';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)} 天前`;
  if (diffSec < 86400 * 365) return `${Math.floor(diffSec / (86400 * 30))} 个月前`;
  return `${Math.floor(diffSec / (86400 * 365))} 年前`;
}

function mapMomentPost(row, images, likes, comments, likedByMe) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.nickname || '',
    avatar: row.avatar || '',
    activityId: row.activity_id,
    activityTitle: row.activity_title || '',
    content: row.content,
    images,
    time: toRelativeTime(row.created_at),
    likeCount: likes.length,
    likedByMe: !!likedByMe,
    likes,
    comments,
  };
}

/**
 * 分页查询动态（moment）帖子列表，并补充每个帖子的图片、点赞人、评论。
 * 支持 keyword/q（模糊匹配 昵称、内容、关联活动标题）过滤，以及 offset/limit 分页（
 * limit 缺省或非法时为 1000）。先查询主帖（LEFT JOIN user_profiles 带发布人昵称头像、
 * LEFT JOIN activities 带活动标题），再并行按帖子 ID 批量查询图片、点赞、评论，分类聚
 * 合后按顺序组装进每个帖子的返回结构。
 * @param {Object} [query] 查询参数，可选 keyword（或 q）、offset（起始偏移，默认 0）、
 *   limit（每页条数，默认 1000）。
 * @param {number} [currentUserId] 当前登录用户 user_id，用于标记每个帖子的 likedByMe；
 *   未提供或为 0 时 likedByMe 恒为 false。
 * @returns {Promise<Array<Object>>}
 *   返回结构：帖子对象数组，每项含 id、userId、name、avatar、activityId、activityTitle、
 *   content、images、time、likeCount、likedByMe、likes（点赞用户昵称数组）、comments
 *   （评论 {user, text} 数组）。无结果时返回空数组。
 * @throws 无显式异常。
 */
export async function listMomentPosts(query = {}, currentUserId = 0) {
  const pool = getPool();
  const conditions = [];
  const params = [];

  const keyword = String(query.keyword || query.q || '').trim().toLowerCase();
  if (keyword) {
    conditions.push('(up.nickname LIKE ? OR mp.content LIKE ? OR a.title LIKE ?)');
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
  const likedUserIdsByPost = {};
  for (const r of likeRows[0]) {
    (likesByPost[r.post_id] ||= []).push(r.username);
    const users = (likedUserIdsByPost[r.post_id] ||= []);
    if (Number(r.user_id)) users.push(Number(r.user_id));
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
      (likedUserIdsByPost[row.id] || []).includes(currentUserId),
    ),
  );
}

/**
 * 构造用于拒绝请求的业务错误，携带 HTTP 状态码，便于路由层统一兜底返回。
 * @param {number} statusCode HTTP 状态码
 * @param {string} message 错误提示
 * @returns {Error}
 */
function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * 校验并返回正整数 ID，非法为 0。
 * @param {*} v 待校验值
 * @returns {number}
 */
function toPositiveInt(v) {
  return Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : 0;
}

/**
 * 发布一条动态。
 * 通过事务同时写入主帖与全部图片：先插入 moment_posts 拿到新 id，再按序插入
 * moment_post_images；任一步失败整体回滚。content 必填，activity_id 可选。
 * @param {number} userId 发布人 user_id
 * @param {Object} payload 载荷
 * @param {number|string} [payload.activity_id] 关联活动（可空）
 * @param {string} payload.content 动态正文（必填）
 * @param {string[]} [payload.image_urls] 图片地址数组（可空）
 * @returns {Promise<{id: number}>} 新动态 id
 * @throws {Error} userId 缺失、content 为空 → 400
 */
export async function createMomentPost(userId, payload = {}) {
  const content = String(payload.content || '').trim();
  if (!userId) throw httpError(400, 'user_id 缺失');
  if (!content) throw httpError(400, 'content 不能为空');

  const activityId = toPositiveInt(payload.activity_id) || null;
  const images = Array.isArray(payload.image_urls)
    ? payload.image_urls.filter((u) => String(u).trim())
    : [];

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [postResult] = await conn.query(INSERT_MOMENT_POST, [userId, activityId, content]);
    const postId = postResult.insertId;

    for (let i = 0; i < images.length; i++) {
      await conn.query(INSERT_MOMENT_IMAGE, [postId, i, String(images[i]).trim()]);
    }

    await conn.commit();
    return { id: postId };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * 校验动态是否存在，不存在时抛 404。
 * @param {number} postId 动态 id
 * @returns {Promise<object>} 动态记录
 */
async function ensurePostExists(postId) {
  const pool = getPool();
  const [rows] = await pool.query(FIND_MOMENT_POST_BY_ID, [postId]);
  if (!rows.length) throw httpError(404, '动态不存在');
  return rows[0];
}

/**
 * 点赞一条动态（幂等：重复点赞不报错）。
 * @param {number} userId 点赞人 user_id
 * @param {number} postId 动态 id
 * @returns {Promise<{post_id, user_id, liked: true}>}
 * @throws {Error} 参数缺失 → 400；动态不存在 → 404
 */
export async function likeMomentPost(userId, postId) {
  if (!userId) throw httpError(400, 'user_id 缺失');
  if (!postId) throw httpError(400, 'post_id 缺失');
  await ensurePostExists(postId);

  const pool = getPool();
  await pool.query(INSERT_MOMENT_LIKE, [postId, userId]);
  return { post_id: postId, user_id: userId, liked: true };
}

/**
 * 取消点赞一条动态（幂等）。
 * @param {number} userId 取消点赞人 user_id
 * @param {number} postId 动态 id
 * @returns {Promise<{post_id, user_id, liked: false}>}
 * @throws {Error} 参数缺失 → 400；动态不存在 → 404
 */
export async function unlikeMomentPost(userId, postId) {
  if (!userId) throw httpError(400, 'user_id 缺失');
  if (!postId) throw httpError(400, 'post_id 缺失');
  await ensurePostExists(postId);

  const pool = getPool();
  await pool.query(DELETE_MOMENT_LIKE, [postId, userId]);
  return { post_id: postId, user_id: userId, liked: false };
}

/**
 * 给动态发一条评论。
 * @param {number} userId 评论人 user_id
 * @param {number} postId 动态 id
 * @param {Object} payload 载荷，text 必填
 * @returns {Promise<{id: number}>} 新评论 id
 * @throws {Error} userId/post_id 缺失或 text 为空 → 400；动态不存在 → 404
 */
export async function addMomentComment(userId, postId, payload = {}) {
  const text = String(payload.text || '').trim();
  if (!userId) throw httpError(400, 'user_id 缺失');
  if (!postId) throw httpError(400, 'post_id 缺失');
  if (!text) throw httpError(400, 'text 不能为空');
  await ensurePostExists(postId);

  const pool = getPool();
  const [result] = await pool.query(INSERT_MOMENT_COMMENT, [postId, userId, text]);
  return { id: result.insertId };
}

/**
 * 删除评论（仅作者本人）。
 * @param {number} userId 操作者 user_id（须为评论作者）
 * @param {number} commentId 评论 id
 * @returns {Promise<{id: number, deleted: true}>}
 * @throws {Error} 参数缺失 → 400；评论不存在 → 404；非作者 → 403
 */
export async function deleteMomentComment(userId, commentId) {
  if (!userId) throw httpError(400, 'user_id 缺失');
  if (!commentId) throw httpError(400, 'comment_id 缺失');

  const pool = getPool();
  const [rows] = await pool.query(FIND_MOMENT_COMMENT_BY_ID, [commentId]);
  if (!rows.length) throw httpError(404, '评论不存在');
  if (Number(rows[0].user_id) !== userId) throw httpError(403, '只能删除自己的评论');

  await pool.query(DELETE_MOMENT_COMMENT, [commentId, userId]);
  return { id: commentId, deleted: true };
}