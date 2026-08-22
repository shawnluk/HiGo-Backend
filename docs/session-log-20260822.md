# 会话日志 - 2026-08-22

## 1. 用户注册功能

**新增文件**：无
**修改文件**：`src/db/queries.js`、`src/services/auth-service.js`、`src/routes/auth.js`

**SQL 新增**：
- `FIND_USER_BY_USERNAME` — 按用户名查用户（注册查重 + 登录验证）
- `INSERT_USER` — 写入 `users` 表（username, password_hash）
- `INSERT_USER_PROFILE` — 写入 `user_profiles` 表（user_id, display_name, avatar_url）

**`register` 函数**（auth-service.js）：
- 校验 username 非空、password 至少 6 位
- 查重（用户名已存在返回 409）
- 密码 PBKDF2 加盐哈希（100000 次迭代，SHA-512）
- 写入 `users` + `user_profiles` 两张表
- 注册成功直接返回 JWT

**路由**：`POST /api/v1/auth/register` → 成功返回 201

**响应**：
```json
{
  "code": 0, "success": true, "message": "registered",
  "data": { "token": "eyJ...", "userId": 1, "username": "testuser", "displayName": "测试用户" }
}
```

---

## 2. 数据库字段名统一

**问题**：`user_profiles` 表实际字段与代码不一致。

**修改**：

| 文件 | 旧字段 | 新字段 |
|------|--------|--------|
| `queries.js` | `SELECT id` | `SELECT user_id` |
| `queries.js` | `user_profiles.display_name` | `user_profiles.nickname` |
| `queries.js` | `user_profiles.avatar_url` | `user_profiles.avatar` |
| `queries.js` | — | `user_profiles.register_time`（新增 NOW()） |
| `auth-service.js` | `payload.display_name` | `payload.nickname` |
| `auth-service.js` | `payload.avatar_url` | `payload.avatar` |

**注册请求体同步**：
```json
{ "username": "testuser", "password": "123456", "nickname": "测试用户", "avatar": "https://..." }
```

---

## 3. 密码处理

### 初始实现：PBKDF2 加盐哈希
- `hashPassword(password)` — 16 字节随机盐 + PBKDF2（100000 次迭代，SHA-512，64 字节输出）
- 存储格式：`salt:hash`
- `verifyPassword(password, stored)` — 提取盐 → 重算 → 对比

### 改为明文存储
- 注释掉 `hashPassword` / `verifyPassword`
- 注册：`password` 直接存入 `password_hash` 字段
- 登录：`rows[0].password_hash !== password` 直接字符串对比

---

## 4. 登录增强：返回 user_profiles 全量信息

**文件**：`queries.js`、`auth-service.js`

**新增 SQL**：`FIND_USER_PROFILE_BY_ID` — 查询 `user_profiles` 全部 14 个字段

**login 流程**：
```
username → 查 users 表 → 密码匹配 → 查 user_profiles 表 → 签发 JWT → 返回 { token, userId, username, profile }
```

**响应**：
```json
{
  "code": 0, "success": true, "message": "ok",
  "data": {
    "token": "eyJ...",
    "userId": 1,
    "username": "testuser",
    "profile": {
      "user_id": 1, "user_no": "U001", "nickname": "测试用户",
      "real_name": null, "identity_card": null, "avatar": "https://...",
      "gender": 0, "birthday": null, "user_status": 0, "user_type": "",
      "last_login_time": null, "register_time": "...", "update_time": "...", "is_deleted": 0
    }
  }
}
```

---

## 5. Token JWT 过期与鉴权中间件

### Token 过期时间：7 天 → 5 分钟
**文件**：`auth-service.js` → register 和 login 两处 `exp` 改为 `now + 60 * 5`

### 新增 `verifyToken` 函数
**文件**：`auth-service.js`（后移至 `lib/token.js`）

校验逻辑：
```
解析 JWT 三段 → 验证 HMAC 签名 → 检查 exp 是否过期 → 返回 payload
失败返回 401（"Token is required" / "Invalid token signature" / "Token has expired"）
```

### app.js 中间件拦截
**文件**：`app.js`（第 55-64 行）

```js
// 公开路由：跳过验证
PUBLIC_PATHS = ['/health', '/api/v1/auth/login', '/api/v1/auth/register', ...]

// 其他路由：提取 Authorization: Bearer <token> → verifyToken → req.user = payload
// 验证失败 → 401
```

---

## 6. Token 逻辑抽离

**新增文件**：`src/lib/token.js`

| 导出 | 用途 |
|------|------|
| `signToken(payload, secret)` | 签发 JWT |
| `verifyToken(token, secret)` | 校验 JWT（签名 + 过期） |
| `makeTokenPayload(sub, extra)` | 构造 payload（含 `iat`、`exp`） |

过期时间常量 `TOKEN_EXPIRY_SECONDS = 60 * 5` 在文件顶部，改一个数字全局生效。

**修改文件**：
- `auth-service.js`：移除 `base64url`、`signToken`、`verifyToken`，改为 `import { signToken, makeTokenPayload }`
- `app.js`：`verifyToken` 改为从 `./lib/token.js` 导入

---

## 7. 公共接口调整

**文件**：`app.js` → `PUBLIC_PATHS`

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 健康检查 |
| `POST` | `/api/v1/auth/login` | 登录 |
| `POST` | `/api/v1/auth/register` | 注册 |
| `GET` | `/api/v1/activities` | 浏览活动（公开） |
| `GET` | `/api/v1/categories` | 浏览分类（公开） |

**需 Token 的接口**：`POST /api/v1/activities`、`GET /api/v1/messages`、`GET /api/v1/moment/posts`

---

## 8. 创建活动：creator_id 从 Token 获取

**问题**：`creator_id` 从前端请求体读取，不可信。

**修改**：

`routes/activities.js`：
```js
router.post('/api/v1/activities', async ({ body, req, res }) => {
  ok(res, await createActivity(body, req.user), 'created', 201);
});
```

`activity-service.js`：
```js
export async function createActivity(payload = {}, user = {}) {
  const creator_id = Number(user.sub) || 0;  // 从 Token 的 sub 字段获取
}
```

前端不再需要传 `creator_id`，后端自动从 Token 提取。

---

## 9. 分类校验逻辑提取

### 提取 `getCategoryById` 函数
**文件**：`activity-service.js`

```js
export async function getCategoryById(categoryId) {
  // 查询 activity_categories 表 → 存在返回 { category_id, tag_text } → 不存在抛 400
}
```

`createActivity` 从 10 行内联查询缩减为：
```js
const category = await getCategoryById(payload.category_id);
```

### 独立为 category-service.js
**新增文件**：`src/services/category-service.js`

| 导出 | 用途 |
|------|------|
| `listCategories()` | 查询全部分类列表 |
| `getCategoryById(id)` | 按 ID 查分类，不存在抛 400 |

**修改文件**：
- `activity-service.js`：移除 `listCategories`、`getCategoryById`，改为 `import { getCategoryById }`
- `routes/categories.js`：导入改为 `from '../services/category-service.js'`

---

## 10. tag_text → category_name 全局重命名

**原因**：`activity_categories` 表中实际字段名为 `category_name`，非 `tag_text`。

**涉及文件**（3 个，共 10 处）：

| 文件 | 改动 |
|------|------|
| `db/queries.js` | `INSERT_ACTIVITY` 列名 |
| `category-service.js` | `SELECT` 查询字段 |
| `activity-service.js` | `mapActivity`、`listActivities` 筛选、`createActivity` 引用 |

---

## 项目当前状态

- **框架**：ES6 Module，零外部依赖，纯 Node.js 内置模块
- **数据库**：MySQL（`mysql2` promise API）
- **鉴权**：JWT（HMAC-SHA256，5 分钟过期，中间件已启用）
- **公共接口**：5 个（health / login / register / activities GET / categories GET）
- **受保护接口**：3 个（activities POST / messages / moment/posts）
- **服务层拆分**：`auth-service`、`activity-service`、`category-service`、`message-service`、`moment-service`
- **工具层**：`lib/token.js`（JWT）、`lib/db.js`（连接池）、`lib/router.js`（路由）、`lib/http.js`（响应工具）