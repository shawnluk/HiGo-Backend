import { ok } from '../lib/http.js';
import {
  addMomentComment,
  createMomentPost,
  deleteMomentComment,
  likeMomentPost,
  listMomentPosts,
  unlikeMomentPost,
} from '../services/moment-service.js';

/**
 * 解析当前操作者 user_id：优先取 token 内 req.user.sub（sub 为字符串），
 * 也允许调用方显式传入 user_id（便于本地调试）。
 * @param {import('http').IncomingMessage} req 请求对象
 * @param {object} body 请求体
 * @returns {number} 解析后的 user_id，非法为 0
 */
function currentUserId(req, body) {
  return Number(body.user_id ?? req.user?.sub) || 0;
}

/**
 * 注册动态（moment）相关的路由。
 *
 * - GET `/api/v1/moment/posts` → 分页返回动态帖子列表（含图片、点赞、评论）。
 * - POST `/api/v1/moment/posts` → 发布动态，payload={user_id?, activity_id?, content, image_urls?}。
 * - POST `/api/v1/moment/posts/:id/like` → 点赞动态。
 * - POST `/api/v1/moment/posts/:id/unlike` → 取消点赞动态。
 * - POST `/api/v1/moment/posts/:id/comments` → 给动态发评论，payload={user_id?, text}。
 * - POST `/api/v1/moment/comments/:id/remove` → 删除评论（仅作者）。
 */
export function registerMomentRoutes(router) {
  router.get('/api/v1/moment/posts', async ({ query, req, res }) => {
    const currentUserId = Number(req.user?.sub) || Number(query.user_id) || 0;
    ok(res, await listMomentPosts(query, currentUserId));
  });

  router.post('/api/v1/moment/posts', async ({ body, req, res }) => {
    ok(res, await createMomentPost(currentUserId(req, body), body), 'created', 201);
  });

  router.post('/api/v1/moment/posts/:id/like', async ({ params, body, req, res }) => {
    ok(res, await likeMomentPost(currentUserId(req, body), Number(params.id)));
  });

  router.post('/api/v1/moment/posts/:id/unlike', async ({ params, body, req, res }) => {
    ok(res, await unlikeMomentPost(currentUserId(req, body), Number(params.id)));
  });

  router.post('/api/v1/moment/posts/:id/comments', async ({ params, body, req, res }) => {
    ok(res, await addMomentComment(currentUserId(req, body), Number(params.id), body));
  });

  router.post('/api/v1/moment/comments/:id/remove', async ({ params, body, req, res }) => {
    ok(res, await deleteMomentComment(currentUserId(req, body), Number(params.id)));
  });
}