# HiGo 会话日志 · 2026-11-13

> 本日志记录当日围绕「用户资料修改 + 头像上传」的后端与前端开发，共涉及后端 8 个文件、前端 5 个文件。

## 概览

- **日期**：2026-11-13
- **主要模块**：用户资料（user_profiles / users）、头像上传（腾讯云 COS / STS）、前端裁剪流程
- **核心成果**
  1. 新增用户资料修改接口 `POST /api/v1/user/profile`（部分更新）
  2. 新增修改密码接口 `POST /api/v1/user/password`
  3. 新增 COS 临时密钥接口 `POST /api/v1/upload/credentials`（STS 方案）
  4. 登录返回体增加 `phone` 字段
  5. 前端接入 `cos-wx-sdk-v5` 直传 + 裁剪流程打通（裁剪 → 上传 → 回填 URL → 更新资料）

## 涉及文件

### 后端（HiGo-Backend）

- `src/db/queries.js`
- `src/services/user-service.js`
- `src/services/auth-service.js`
- `src/routes/user.js`
- `src/routes/upload.js`
- `src/lib/sts.js`（新增）
- `src/config.js`
- `.env` / `.env.example`
- `docs/用户资料修改接口.md`（新增接口文档）
- `src/lib/cos.js`（已删除，预签名逻辑弃用）

### 前端（HiGo-Frontend）

- `utils/cos-wx-sdk-v5.js`（新增：SDK dist + window shim）
- `utils/cos-upload.js`（新增：COS 实例 + `uploadAvatar`）
- `constants/api-paths.js`
- `api/modules/user.js`
- `pages/user/user.vue`

---

## 一、需求演进与字段约定

围绕「用户能修改哪些字段」逐步收敛，最终确定：

**用户可自助修改的字段**：`phone`、`nickname`、`avatar`、`birthday`、`gender`、`password`

**明确不可由用户修改的字段**（系统 / 管理员维护）：

- `real_name`：需实名认证，暂缓不做
- `user_type` / `user_status` / `is_deleted` / `user_no` / `identity_card`：系统或管理员维护
- `user_id`：仅作为定位标识，由后端从 token 解析，不接受前端传入

**头像方案**：前端裁剪 → 上传 COS/OSS 拿 URL → 把 URL 传给资料接口的 `avatar` 字段（不存 base64、不传文件流）。

---

## 二、后端改动明细

### 1. 查询层 `src/db/queries.js`

- 新增 `FIND_USER_BY_ID`、`FIND_USER_PASSWORD_BY_ID`
- 新增 `UPDATE_USER_PHONE`、`UPDATE_USER_PASSWORD`
- 新增 `UPDATE_USER_PROFILE`（使用 `{{set}}` 占位动态拼装 SET 子句，实现部分更新）
- `FIND_USER_BY_USERNAME` 的 SELECT 增加 `phone`

### 2. 服务层 `src/services/user-service.js`

- `updateProfile(userId, payload)`：部分更新手机号与资料字段
- `changePassword(userId, payload)`：校验旧密码后写入新密码

### 3. 鉴权/登录 `src/services/auth-service.js`

- `login` 返回体增加 `phone: user.phone ?? ''`（无论是否为空都返回）

### 4. 路由 `src/routes/user.js`

- `POST /api/v1/user/profile` → `updateProfile(userId, body)`
- `POST /api/v1/user/password` → `changePassword(userId, body)`
- `userId` 一律取 `Number(req.user?.sub) || 0`，不从 body 传入

### 5. 头像上传 `src/lib/sts.js`（新增）+ `src/routes/upload.js`

- 采用 **STS 临时密钥**方案（弃用原预签名 URL，`src/lib/cos.js` 已删除）
- `src/lib/sts.js`：纯原生 `crypto` + `https` 实现 TC3-HMAC-SHA256 签名，调用 `GetFederationToken` 换临时密钥
- 授权策略 `buildCosUploadPolicy` 限定：
  - `resource`: `qcs::cos:<region>:uid/<appid>:<bucket>/user-avatar/<userId>/*`
  - `action`: 仅 `PutObject` / `PostObject`
- `src/routes/upload.js`：`POST /api/v1/upload/credentials`
  - 需登录（401 拦截）
  - 临时密钥有效期 `CREDENTIALS_EXPIRES = 1800` 秒
  - 存储前缀 `prefix = user-avatar/<userId>/`（以用户 ID 为前缀）
  - 返回：`{ tmpSecretId, tmpSecretKey, token, expiredTime, bucket, region, prefix }`

### 6. 配置 `src/config.js` / `.env`

- 读取 `COS_SECRET_ID` / `COS_SECRET_KEY` / `COS_BUCKET` / `COS_REGION`
- `COS_BUCKET = unitone-1310134019`，`COS_REGION = ap-guangzhou`
- 主密钥只存后端，不出后端

---

## 三、前端改动明细

### 1. `utils/cos-wx-sdk-v5.js`（新增）

- 从 `unpkg` 下载 `cos-wx-sdk-v5@1.8.0` dist（约 205KB），本地引用（项目无 npm/package.json）
- 顶部 prepend window shim：小程序无 `window` 全局，SDK UMD 加载时引用 `window` 会报错：

```js
if (typeof window === 'undefined') { var window = {} }
```

### 2. `utils/cos-upload.js`（新增）

- 封装单例 COS 实例，`getAuthorization` 里调 `POST /api/v1/upload/credentials` 换临时密钥（带缓存，有效期内复用）
- `uploadAvatar(filePath)`：按后端下发的 `prefix` 拼对象键 `<prefix><时间戳>_<随机>.<ext>`，`postObject` 直传后返回完整 URL
- 存储前缀用后端下发的 `prefix`，不依赖前端 `userId`，避免与 token 解析出的 userId 不一致

### 3. `constants/api-paths.js`

- 新增 `uploadCredentials: '/api/v1/upload/credentials'`

### 4. `api/modules/user.js`

- 新增 `updateProfile(payload)`（POST `/api/v1/user/profile`，userId 由后端 token 解析）

### 5. `pages/user/user.vue`

- `handleCrop` 增加登录校验（未登录跳登录页）
- `onCropperCrop` 改为：裁剪完成 → `uploadAvatar` 直传 COS 拿 URL → `updateProfile({ avatar })` 更新后端 → 回填本地 `avatarUrl` 并写回缓存 `userInfo.avatar`
- 新增 `persistAvatar(url)` 将新头像写回本地缓存

---

## 四、字段校验规则汇总

### 资料修改 `POST /api/v1/user/profile`

| 字段 | 校验规则 | 说明 |
|------|----------|------|
| `phone` | `^1[3-9]\d{9}$`；非空时查重（排除自身） | 位于 `users` 表，单独处理 |
| `nickname` | 非空 | 位于 `user_profiles` 表 |
| `avatar` | 有效 `http/https` URL，≤ 500 字符 | 与 `avatar VARCHAR(500)` 对齐 |
| `birthday` | `^\d{4}-\d{2}-\d{2}$`，可空 | 空值写入 NULL |
| `gender` | `0` / `1` / `2`（0=保密/未知，1=男，2=女） | 空值写入 NULL |

### 修改密码 `POST /api/v1/user/password`

- `old_password`、`new_password` 均为必填
- 新密码：长度 6-10 位，仅中文 / 字母 / 数字 / 下划线 / 连字符（`^[\u4e00-\u9fa5A-Za-z0-9_-]+$`）
- 校验旧密码正确后写入新密码

---

## 五、已知问题 / 踩坑

- **密码明文存储**：当前 `users.password_hash` 实际存的是明文，注册直接写入、登录/改密直接比对（历史遗留，后续需迁移为加盐哈希）。
- **cos-wx-sdk-v5 无 window 环境报错**：通过顶部 shim `window` 解决；SDK 内部顶层还引用 `wx`（`wx.getFileSystemManager()` 等），仅在小程序运行时存在，Node 下会报错属正常。
- **前端无 npm**：改用「下载 SDK dist 到本地 + `@/` 别名 import」方案，而非 `npm install`。
- **存储路径纠偏**：头像对象键前缀为 `user-avatar/<userId>/`（此前一度误设为 `avatar/<userId>/`）。

---

## 项目当前状态

- **框架**：ES6 Module，零外部依赖，纯 Node.js 内置模块（后端）
- **数据库**：MySQL（utf8mb4），库名 `HiGo`；`users`（登录凭据）+ `user_profiles`（资料）
- **鉴权**：JWT（HMAC-SHA256），受保护接口需 `Authorization: Bearer <token>`
- **用户资料**：`updateProfile` / `changePassword` 已就绪；`userId` 统一由 token 解析
- **头像上传**：STS 临时密钥 + COS 直传，路径 `user-avatar/<userId>/`
- **前端**：HBuilderX 版 uni-app（无 npm），`request()` 封装 + `ApiPaths` 常量 + 裁剪组件 `QfImageCropper`
