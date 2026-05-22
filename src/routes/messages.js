const { ok } = require('../lib/http');
const { listMessages } = require('../services/message-service');

function registerMessageRoutes(router) {
  router.get('/api/v1/messages', ({ query, res }) => {
    ok(res, listMessages(query));
  });
}

module.exports = { registerMessageRoutes };
