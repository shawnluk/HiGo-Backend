import http from 'node:http';
import { URL } from 'node:url';
import { getConfig } from './config.js';
import { initPool } from './lib/db.js';
import { createRouter } from './lib/router.js';
import {
  fail,
  ok,
  queryObject,
  readJsonBody,
  setCorsHeaders,
} from './lib/http.js';
import { registerActivityRoutes } from './routes/activities.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerCategoryRoutes } from './routes/categories.js';
import { registerMessageRoutes } from './routes/messages.js';
import { registerMomentRoutes } from './routes/moment.js';
import { registerSquadRoutes } from './routes/squads.js';
import { verifyToken } from './lib/token.js';

const PUBLIC_PATHS = [
  '/health',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/activities',
  '/api/v1/categories',
  '/api/v1/moment/posts',
];

function registerRoutes(router) {
  router.get('/health', ({ res }) => {
    ok(res, {
      name: 'unitone-backend',
      status: 'ok',
      time: new Date().toISOString(),
    });
  });

  registerAuthRoutes(router);
  registerCategoryRoutes(router);
  registerActivityRoutes(router);
  registerMessageRoutes(router);
  registerMomentRoutes(router);
  registerSquadRoutes(router);
}

/**
 * 创建并启动应用实例，返回一个 HTTP Server。
 * 核心流程：
 * 1. 根据配置 `config` 初始化数据库连接池（initPool）。
 * 2. 创建路由实例并注册各业务模块路由（auth / category / activity / message / moment / squad），
 *    同时注册 `/health` 健康检查接口。
 * 3. 返回 http.createServer，请求处理流程如下：
 *    - 先设置 CORS 响应头；若是 OPTIONS 预检请求，直接返回 204。
 *    - 对于不在 `PUBLIC_PATHS`（免鉴权路径：/health、/api/v1/auth/login、
 *      /api/v1/auth/register、/api/v1/activities、/api/v1/categories）中的路径，
 *      从 Authorization 头取出 Bearer token，调用 `verifyToken` 校验，
 *      失败则返回 401 并中断请求；成功后把用户信息挂到 req.user。
 *    - 通过 `router.match` 匹配路由，未命中返回 404。
 *    - 非 GET/HEAD 请求读取请求体，随后交给对应路由 handler 处理；
 *      处理过程中的异常统一兜底：500 及以上返回通用的
 *      `Internal server error` 并打印错误日志，其余返回其自身的错误信息。
 *
 * @param {object} [config] 应用配置，缺省时使用 getConfig() 读取环境变量配置。
 * @returns {import('node:http').Server} 已创建的 HTTP Server。
 */
export function createApp(config = getConfig()) {
  initPool(config);

  const router = createRouter();
  registerRoutes(router);

  return http.createServer(async (req, res) => {
    setCorsHeaders(res, config);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (!PUBLIC_PATHS.includes(requestUrl.pathname)) {
      try {
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        req.user = verifyToken(token, config.jwtSecret);
      } catch (error) {
        fail(res, error.statusCode || 401, error.message);
        return;
      }
    }
    const route = router.match(req.method, requestUrl.pathname);

    if (!route) {
      fail(res, 404, `Route not found: ${req.method} ${requestUrl.pathname}`);
      return;
    }

    try {
      const body = req.method === 'GET' || req.method === 'HEAD' ? {} : await readJsonBody(req);
      await route.handler({
        body,
        config,
        params: route.params || {},
        query: queryObject(requestUrl.searchParams),
        req,
        res,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      const message = statusCode >= 500 ? 'Internal server error' : error.message;
      fail(res, statusCode, message);
      if (statusCode >= 500) {
        console.error(error);
      }
    }
  });
}