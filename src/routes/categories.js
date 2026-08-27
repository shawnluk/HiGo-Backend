import { ok } from '../lib/http.js';
import { listCategories } from '../services/category-service.js';

/**
 * 注册分类相关的路由。
 *
 * - GET `/api/v1/categories` → 调用 category-service 的 `listCategories`，
 *   返回全部分类列表。
 *
 * @param {import('../lib/router.js').Router} router 路由实例，用于挂载接口。
 */
export function registerCategoryRoutes(router) {
  router.get('/api/v1/categories', async ({ res }) => {
    ok(res, await listCategories());
  });
}