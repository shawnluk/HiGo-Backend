import { ok } from '../lib/http.js';
import { listCategories } from '../services/activity-service.js';

export function registerCategoryRoutes(router) {
  router.get('/api/v1/categories', async ({ res }) => {
    ok(res, await listCategories());
  });
}