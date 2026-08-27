import { ok } from '../lib/http.js';
import { listMessages } from '../services/message-service.js';

/**
 * 注册消息相关的路由。
 *
 * - GET `/api/v1/messages` → 调用 message-service 的 `listMessages`，
 *   按查询参数返回消息列表。
 *
 * @param {import('../lib/router.js').Router} router 路由实例，用于挂载接口。
 */
export function registerMessageRoutes(router) {
  router.get('/api/v1/messages', async ({ query, res }) => {
    ok(res, await listMessages(query));
  });
}