# 会话日志 - 2026-08-30

## 1. 动态（moment / 朋友圈）表结构与 service 适配

**说明**：把 moment 从「冗余字段」结构升级为关联真实 `user_profiles` / `activities` 的新结构，去掉了原 `name/avatar/activity_title/time/like_count` 冗余字段。

**数据表调整**（本次为存量库执行建表 + 回填）：
```
moment_posts           id(user_id, activity_id, content, created_at)
moment_post_images     id(post_id, sort_order, image_url)
moment_post_likes      id(post_id, user_id), UNIQUE uk_like(post_id, user_id)
moment_post_comments   id(post_id, user_id, text, created_at)
```
- `user_id` → `user_profiles(user_id)`，`ON DELETE CASCADE`
- `activity_id` → `activities(activity_id)`，允许 NULL，`ON DELETE SET NULL`
- 图片/点赞/评论均外键到 `moment_posts(id)`，`ON DELETE CASCADE`

**修改文件**：
- `src/db/queries.js` — `LIST_MOMENT_POSTS` 改为 `LEFT JOIN user_profiles`（昵称/头像）+ `LEFT JOIN activities`（活动标题），WHERE 过滤改用别名
- `src/services/moment-service.js` — `mapMomentPost` 改用 JOIN 字段（`name/avatar/activityTitle`），`likeCount` 由点赞实时统计，新增 `toRelativeTime()` 由 `created_at` 换算 `time`

> 建表时踩坑 `ERROR 1215`：moment 表 `user_id/activity_id` 初始建为 `INT`，与被引用的 `BIGINT UNSIGNED` 类型不一致，需统一改成 `BIGINT UNSIGNED`（与之前 `activity_member.activity_id` 教训相同）。

---

## 2. 动态种子数据（对应真实表）

**说明**：给 4 张新表插入演示数据，发帖人/点赞/评论的 `user_id` 全部取自现有 `user_profiles`（1~18），`activity_id` 取自现有 `activities`（1/21/43/26），且发帖人都是该活动所属小队的在队成员。

**回填结果**：`moment_posts`=4、`moment_post_images`=14、`moment_post_likes`=11、`moment_post_comments`=12。

---

## 3. 新增动态写入接口

**说明**：原仅实现读取（GET），本次补齐发布/点赞/评论等写接口。按项目既有风格**全部使用 POST**（避免引入 DELETE 需改 CORS 与 router），操作者 `user_id` 取 `body.user_id ?? req.user.sub`。

| 接口 | 作用 | 请求 body |
|------|------|-----------|
| `POST /api/v1/moment/posts` | 发布动态 | `{ user_id?, activity_id?, content, image_urls? }` |
| `POST /api/v1/moment/posts/:id/like` | 点赞（幂等） | `{ user_id? }` |
| `POST /api/v1/moment/posts/:id/unlike` | 取消点赞（幂等） | `{ user_id? }` |
| `POST /api/v1/moment/posts/:id/comments` | 发评论 | `{ user_id?, text }` |
| `POST /api/v1/moment/comments/:id/remove` | 删评论（仅作者） | `{ user_id? }` |

**修改文件**：
- `src/db/queries.js` — 新增 10 条 INSERT/DELETE/FIND 语句
- `src/services/moment-service.js` — `createMomentPost`（事务写入主帖+图片）、`likeMomentPost`/`unlikeMomentPost`（幂等）、`addMomentComment`、`deleteMomentComment`（校验归属）
- `src/routes/moment.js` — 注册 5 条 POST 路由

**冒烟验证**：发布→读取（昵称/活动标题/点赞数/图数/评论数/时间全部正确）→点赞→评论→删评论，全部通过；测试数据已清理，四表恢复 4/14/11/12。

---

## 4. GET 动态新增 likedByMe 字段

**说明**：修复前端按昵称比对「是否我点的赞」会因同名著误判的问题，改为后端按 `user_id` 精确判定。

**修改文件**：
- `src/db/queries.js` — `BATCH_POST_LIKES` 的 SELECT 增加 `ml.user_id`
- `src/services/moment-service.js` — `mapMomentPost` 新增 `likedByMe`；`listMomentPosts(query, currentUserId)` 按点赞者 `user_id` 集合判 `includes(currentUserId)`
- `src/routes/moment.js` — GET 时传 `req.user?.sub || query.user_id || 0`

```json
{ "id": 4, "likes": ["林林", "浩浩"], "likeCount": 2, "likedByMe": true }
```

---

## 项目当前状态

- **框架**：ES6 Module，零外部依赖，纯 Node.js 内置模块
- **数据库**：MySQL（`mysql2` promise API），库名 `HiGo`
- **鉴权**：JWT（HMAC-SHA256），受保护接口需 `Authorization` 头
- **用户表**：`users`（登录凭据）+ `user_profiles`（资料，`user_id` 主键、含 `nickname/avatar`），不在 `sql/init.sql` 建表
- **动态表**：`moment_posts` / `moment_post_images` / `moment_post_likes` / `moment_post_comments` 均已为新结构并含外键
- **动态接口**：GET 列表（分页 + likedByMe）+ 5 个写接口（发布/赞/取消赞/评论/删评论）
- **服务层**：`auth-service`、`activity-service`、`category-service`、`message-service`、`moment-service`、`squad-service`
- **工具层**：`lib/token.js`、`lib/db.js`、`lib/router.js`（支持 `:param` 匹配）、`lib/http.js`

### 踩坑记录（新增）
- 手动调用 `initPool(config)` 测试时必须传 `dbHost/dbPort/dbUser/dbPassword/dbName`（db 前缀）字段；传成 `host/port/user` 会静默连本地 `localhost:3306` 并 `ECONNREFUSED`。