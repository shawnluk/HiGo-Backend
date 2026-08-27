import { ok } from '../lib/http.js';
import {
  assertSquadMemberAccess,
  createSquad,
  getSquadDetail,
  joinSquad,
  leaveSquad,
  listMySquads,
  listSquads,
  transferCaptain,
} from '../services/squad-service.js';

/**
 * 注册小队（squad）相关的路由。
 *
 * - GET `/api/v1/squads` → 调用 squad-service 的 `listSquads`，按查询参数返回小队列表。
 * - GET `/api/v1/squads/mine` → 调用 squad-service 的 `listMySquads`，
 *   返回当前用户（取 query.user_id，缺省用 req.user.sub）加入的小队列表。
 * - GET `/api/v1/squads/:id` → 先经 squad-service 的 `assertSquadMemberAccess` 校验成员权限，
 *   再调用 `getSquadDetail` 返回小队详情。
 * - POST `/api/v1/squads` → 调用 squad-service 的 `createSquad`，由当前用户创建新小队，返回 201（created）。
 * - POST `/api/v1/squads/:id/join` → 调用 squad-service 的 `joinSquad`，加入指定小队。
 * - POST `/api/v1/squads/:id/leave` → 调用 squad-service 的 `leaveSquad`，退出指定小队。
 * - POST `/api/v1/squads/:id/captain` → 调用 squad-service 的 `transferCaptain`，转移队长身份。
 *
 * @param {import('../lib/router.js').Router} router 路由实例，用于挂载接口。
 */
export function registerSquadRoutes(router) {
  router.get('/api/v1/squads', async ({ query, res }) => {
    ok(res, await listSquads(query));
  });

  router.get('/api/v1/squads/mine', async ({ query, req, res }) => {
    const userId = query.user_id || req.user.sub;
    ok(res, await listMySquads(userId));
  });

  router.get('/api/v1/squads/:id', async ({ params, req, res }) => {
    await assertSquadMemberAccess(params.id, req.user);
    ok(res, await getSquadDetail(params.id));
  });

  router.post('/api/v1/squads', async ({ body, req, res }) => {
    ok(res, await createSquad(body, req.user), 'created', 201);
  });

  router.post('/api/v1/squads/:id/join', async ({ params, body, req, res }) => {
    ok(res, await joinSquad(params.id, body, req.user), 'joined');
  });

  router.post('/api/v1/squads/:id/leave', async ({ params, body, req, res }) => {
    ok(res, await leaveSquad(params.id, body, req.user), 'left');
  });

  router.post('/api/v1/squads/:id/captain', async ({ params, body, req, res }) => {
    ok(res, await transferCaptain(params.id, body, req.user), 'transferred');
  });
}