import { ok } from '../lib/http.js';
import { createActivity, getActivityDetail, listActivities, reportActivityView } from '../services/activity-service.js';

/**
 * 注册活动相关的路由。
 *
 * - GET `/api/v1/activities` → 调用 activity-service 的 `listActivities`，
 *   根据查询参数返回符合条件的活动列表。
 * - POST `/api/v1/activities` → 调用 activity-service 的 `createActivity`，
 *   由当前登录用户（req.user）创建新活动，成功时返回 201（created）。
 *
 * @param {import('../lib/router.js').Router} router 路由实例，用于挂载接口。
 */
export function registerActivityRoutes(router) {
  router.get('/api/v1/activities', async ({ query, res }) => {
    ok(res, await listActivities(query));
  });

  router.get('/api/v1/activities/:id', async ({ params, res }) => {
    ok(res, await getActivityDetail(params.id));
  });

  router.post('/api/v1/activities', async ({ body, req, res }) => {
    ok(res, await createActivity(body, req.user), 'created', 201);
  });

  // 上报活动浏览热度：已登录按 user_id 去重，未登录按 body.device_id 去重
  router.post('/api/v1/activities/:id/views', async ({ params, body, req, res }) => {
    ok(
      res,
      await reportActivityView(params.id, {
        userId: req.user?.sub,
        deviceId: body?.device_id,
      }),
    );
  });
}