import { ok } from '../lib/http.js';
import { login, register } from '../services/auth-service.js';

/**
 * 注册认证相关的路由。
 * 注册的接口路径与方法及各自调用的 service 函数如下：
 *
 * - POST `/api/v1/auth/register` → 调用 auth-service 的 `register`，
 *   用于创建新用户，成功时返回 201（created）。
 * - POST `/api/v1/auth/login` → 调用 auth-service 的 `login`，
 *   用于登录校验并生成 token。
 *
 * @param {import('../lib/router.js').Router} router 路由实例，用于挂载接口。
 */
export function registerAuthRoutes(router) {
  router.post('/api/v1/auth/register', async ({ body, config, res }) => {
    ok(res, await register(body, config), 'registered', 201);
  });

  router.post('/api/v1/auth/login', async ({ body, config, res }) => {
    ok(res, await login(body, config));
  });
}