const { ok } = require('../lib/http');
const { login } = require('../services/auth-service');

function registerAuthRoutes(router) {
  router.post('/api/v1/auth/login', ({ body, config, res }) => {
    ok(res, login(body, config));
  });
}

module.exports = { registerAuthRoutes };
