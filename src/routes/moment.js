import { ok } from '../lib/http.js';
import { listMomentPosts } from '../services/moment-service.js';

export function registerMomentRoutes(router) {
  router.get('/api/v1/moment/posts', async ({ query, res }) => {
    ok(res, await listMomentPosts(query));
  });
}