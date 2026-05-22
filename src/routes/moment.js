const { ok } = require('../lib/http');
const { listMomentPosts } = require('../services/moment-service');

function registerMomentRoutes(router) {
  router.get('/api/v1/moment/posts', ({ query, res }) => {
    ok(res, listMomentPosts(query));
  });
}

module.exports = { registerMomentRoutes };
