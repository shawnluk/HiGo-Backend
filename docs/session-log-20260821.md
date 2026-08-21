# 会话日志 - 2026-08-21

## 1. 项目代码规范升级：CommonJS → ES6 Module

**范围**：所有 `.js` 文件（共 18 个）

**变更**：
- `package.json` 添加 `"type": "module"`
- `require()` → `import`
- `module.exports` → `export`
- 相对路径导入添加 `.js` 扩展名（ESM 强制要求）

**涉及文件**：
- `package.json`
- `src/server.js` — `import { createApp } from './app.js'`
- `src/config.js` — `export function getConfig()`
- `src/app.js` — `import http from 'node:http'`
- `src/lib/router.js` — `export function createRouter()`
- `src/lib/http.js` — `export function ok/res/fail/...`
- `src/routes/auth.js` — `import { ok } from '../lib/http.js'`
- `src/routes/activities.js`
- `src/routes/messages.js`
- `src/routes/moment.js`
- `src/services/auth-service.js` — `import crypto from 'node:crypto'`
- `src/services/activity-service.js`
- `src/services/message-service.js`
- `src/services/moment-service.js`
- `src/data/activities.js` — `export const seedActivities`
- `src/data/messages.js` — `export const seedMessages`
- `src/data/moment-posts.js` — `export const seedMomentPosts`
- `test/api.test.js` — `import assert from 'node:assert/strict'`

**验证**：4 个测试全部通过，服务正常启动，所有 6 个 API 接口正常响应。

---

## 2. 活动列表分页接口改造

**文件**：`src/services/activity-service.js` → `listActivities()`

**变更**：
- 默认每页条数从 `1000` 改为 `10`
- 新增 `SELECT COUNT(*)` 查询获取符合条件的总记录数
- 返回值从纯数组 `[...]` 改为分页结构 `{ items, total, hasMore }`

**响应格式**：
```json
{
  "code": 0,
  "success": true,
  "message": "ok",
  "data": {
    "items": [...],
    "total": 46,
    "hasMore": true
  }
}
```

**前端分页调用**：
| 请求 | 说明 |
|------|------|
| `GET /api/v1/activities` | 首页（offset=0，默认10条） |
| `GET /api/v1/activities?offset=10` | 第2页 |
| `GET /api/v1/activities?offset=20` | 第3页 |
| `GET /api/v1/activities?limit=5` | 自定义每页条数 |

---

## 3. 活动列表排序修改

**文件**：`src/db/queries.js` → `LIST_ACTIVITIES`

**变更**：`ORDER BY created_at DESC` → `ORDER BY created_at ASC`

**原因**：前端首页需从最早创建的活动开始展示，分页滚动时按时间正序加载。

---

## 4. 创建活动 API 恢复

**文件**：`src/services/activity-service.js` → `createActivity()`

**问题**：`createActivity` 被替换为 `console.log(payload)` 空桩，原实现被注释。

**修复**：
- 恢复完整的创建活动逻辑（分类校验、字段处理、数据库插入）
- 修复注释代码中的 bug：变量名 `categoryId` 与 `category_id` 不一致
- 路由层 `ok(res, ..., 'created', 201)` 正确返回 HTTP 201 和创建成功响应

**成功响应（201）**：
```json
{
  "code": 0,
  "success": true,
  "message": "created",
  "data": { "activity_id": 47, ... }
}
```

**失败响应**：
- 缺少 title → 400 `"Activity title is required"`
- 无效 category_id → 400 `"Invalid category_id: xxx"`