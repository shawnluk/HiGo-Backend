import { ok } from '../lib/http.js';
import { createActivity, listActivities } from '../services/activity-service.js';

export function registerActivityRoutes(router) {
  router.get('/api/v1/activities', ({ query, res }) => {
    ok(res, listActivities(query));
  });

  router.post('/api/v1/activities', ({ body, res }) => {
    ok(res, createActivity(body), 'created', 201);
  });
}