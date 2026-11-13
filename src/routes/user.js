import { ok } from '../lib/http.js';
import { changePassword, updateProfile } from '../services/user-service.js';

/**
 * 注册用户资料相关的路由。
 *
 * - POST `/api/v1/user/profile` → 调用 user-service 的 `updateProfile`，
 *   更新当前用户的手机号、昵称、真实姓名、头像、生日、性别等资料，
 *   payload 中出现的字段才会被更新（部分更新）。
 * - POST `/api/v1/user/password` → 调用 user-service 的 `changePassword`，
 *   校验旧密码后修改为新密码。
 *
 * @param {import('../lib/router.js').Router} router 路由实例，用于挂载接口。
 */
export function registerUserRoutes(router) {
  router.post('/api/v1/user/profile', async ({ body, req, res }) => {
    const userId = Number(req.user?.sub) || 0;
    ok(res, await updateProfile(userId, body), 'updated');
  });

  router.post('/api/v1/user/password', async ({ body, req, res }) => {
    const userId = Number(req.user?.sub) || 0;
    ok(res, await changePassword(userId, body), 'updated');
  });
}
