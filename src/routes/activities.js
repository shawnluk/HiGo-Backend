import { ok } from '../lib/http.js';
import { createActivity, listActivities } from '../services/activity-service.js';

export function registerActivityRoutes(router) {
  router.get('/api/v1/activities', async ({ query, res }) => {
    ok(res, await listActivities(query));
  });

  router.post('/api/v1/activities', async ({ body, res }) => {
    ok(res, await createActivity(body), 'created', 201);
  });
}