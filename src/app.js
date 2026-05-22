const http = require('node:http');
const { URL } = require('node:url');
const { getConfig } = require('./config');
const { createRouter } = require('./lib/router');
const {
  fail,
  ok,
  queryObject,
  readJsonBody,
  setCorsHeaders,
} = require('./lib/http');
const { registerActivityRoutes } = require('./routes/activities');
const { registerAuthRoutes } = require('./routes/auth');
const { registerMessageRoutes } = require('./routes/messages');
const { registerMomentRoutes } = require('./routes/moment');

function registerRoutes(router) {
  router.get('/health', ({ res }) => {
    ok(res, {
      name: 'unitone-backend',
      status: 'ok',
      time: new Date().toISOString(),
    });
  });

  registerAuthRoutes(router);
  registerActivityRoutes(router);
  registerMessageRoutes(router);
  registerMomentRoutes(router);
}

function createApp(config = getConfig()) {
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

module.exports = { createApp, registerRoutes };
