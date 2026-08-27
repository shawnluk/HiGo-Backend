import { ok } from '../lib/http.js';
import { listMomentPosts } from '../services/moment-service.js';

/**
 * 注册动态（moment）相关的路由。
 *
 * - GET `/api/v1/moment/posts` → 调用 moment-service 的 `listMomentPosts`，
 *   按查询参数返回动态帖子列表。
 *
 * @param {import('../lib/router.js').Router} router 路由实例，用于挂载接口。
 */
export function registerMomentRoutes(router) {
  router.get('/api/v1/moment/posts', async ({ query, res }) => {
    ok(res, await listMomentPosts(query));
  });
}