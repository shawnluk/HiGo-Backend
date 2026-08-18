import { ok } from '../lib/http.js';
import { listMomentPosts } from '../services/moment-service.js';

export function registerMomentRoutes(router) {
  router.get('/api/v1/moment/posts', ({ query, res }) => {
    ok(res, listMomentPosts(query));
  });
}