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
import { verifyToken } from './lib/token.js';

const PUBLIC_PATHS = ['/health', '/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/activities', '/api/v1/categories'];

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
}

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