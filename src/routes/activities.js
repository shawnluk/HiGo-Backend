const { ok } = require('../lib/http');
const { createActivity, listActivities } = require('../services/activity-service');

function registerActivityRoutes(router) {
  router.get('/api/v1/activities', ({ query, res }) => {
    ok(res, listActivities(query));
  });

  router.post('/api/v1/activities', ({ body, res }) => {
    ok(res, createActivity(body), 'created', 201);
  });
}

module.exports = { registerActivityRoutes };
