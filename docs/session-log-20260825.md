# 会话日志 - 2026-08-25

## 1. 新建小队表，打通数据库关系

**说明**：新增 `squad`（小队表，主键 `squad_id` 自增）与 `squad_member`（小队员表）两张表，并从后端建立 API 路由链路。

**修改文件**：
- `sql/init.sql` — 补充 `squad`、`squad_member` 建表 DDL（自增主键、外键级联、索引）
- `src/db/queries.js` — 新增小队相关 SQL
- `src/services/squad-service.js`（**新增**）— 数据访问 + 业务映射
- `src/routes/squads.js`（**新增**）— 小队路由
- `src/app.js` — 注册小队路由，并把 `params` 传入 handler
- `src/lib/router.js` — 支持 `:id` 路径参数（向后兼容原有精确匹配）

**建表（`squad`）**：
```
squad_id（主键自增）| squad_name | squad_avatar | captain_id | vice_captain_id
| intro | category_id | max_members | member_count | join_type | status
| invite_code | create_time | update_time | delete_flag
```

**建表（`squad_member`）**：
```
id（自增）| squad_id（FK→squad.squad_id, 级联删除）| user_id
| member_role(0=队长/1=普通/2=副队长) | member_status(0=退出/1=在队)
| join_time | quit_time | remark | create_time | update_time
```

**路由返回字段**（snake→camel 由 service 映射）：
- 小队：`squad_id`、`name`、`avatar`、`captain_id`、`vice_captain_id`、`intro`、`category_id`、`max_members`、`member_count`、`join_type`、`status`、`invite_code`、`create_time`、`update_time`
- 成员：`squad_id`、`user_id`、`role`、`status`、`join_time`、`quit_time`、`remark`

---

## 2. 小队基础接口

**文件**：`src/routes/squads.js`、`src/services/squad-service.js`

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/squads` | 小队列表（支持 `category_id`、`join_type`、`keyword/q`、`offset`、`limit` 分页） |
| `GET` | `/api/v1/squads/:id` | 小队详情，附带 `members` |
| `POST` | `/api/v1/squads` | 创建小队，自动写入队长/副队长成员记录 |

**SQL 新增**：`LIST_SQUADS`、`COUNT_SQUADS`、`GET_SQUAD_BY_ID`（按 `squad_id`）、`LIST_SQUAD_MEMBERS`、`INSERT_SQUAD`、`INSERT_SQUAD_MEMBER`

**router.js 升级**：新增动态路径参数匹配，`/api/v1/squads/:id` 可捕获 `id`；同时在 app.js 把 `route.params` 透传到 handler。

---

## 3. 加入 / 退出小队

**文件**：`src/routes/squads.js`、`src/services/squad-service.js`

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/v1/squads/:id/join` | 加入小队 |
| `POST` | `/api/v1/squads/:id/leave` | 退出小队 |

**加入逻辑**：
- `user_id` 优先取 `body.user_id`，缺省用 Token `user.sub`
- 已在队 → 400「你已在该小队中」
- 满员保护：`UPDATE ... SET member_count = member_count + 1 WHERE member_count < max_members`（原子自增，affectedRows=0 即满员）
- 首次加入插入成员记录；曾退出者 `REJOIN_SQUAD_MEMBER` 置回在队

**退出逻辑**：
- 不在队 → 400「你不在该小队中」
- 队长（`member_role=0`）不可退出，提示先转让队长
- 置 `member_status=0`、记录 `quit_time`，并递减 `member_count`

**SQL 新增**：`FIND_SQUAD_MEMBER`、`REJOIN_SQUAD_MEMBER`、`LEAVE_SQUAD_MEMBER`、`INC_SQUAD_MEMBER_COUNT`、`DEC_SQUAD_MEMBER_COUNT`

---

## 4. 我的小队列表 + 转让队长

**文件**：`src/routes/squads.js`、`src/services/squad-service.js`

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/squads/mine` | 查询我的小队列表 |
| `POST` | `/api/v1/squads/:id/captain` | 转让队长 |

**mine**：`GET` 已注册在 `/:id` 之前避免被当作 id 捕获；`user_id` 优先取 `query.user_id`，缺省用 Token `user.sub`；关联 `squad_member` 返回在队且未删除的小队。

**captain（转让队长）**：
- 发起者必须是队长，否则 403「仅队长可转让队长」
- 目标须为队内在队成员且非本人，否则 400
- 成功后：目标 `member_role=0`，原队长 `member_role=1`，并同步 `squad.captain_id`

**SQL 新增**：`LIST_MY_SQUADS`、`SET_MEMBER_ROLE`、`UPDATE_SQUAD_CAPTAIN`

---

## 5. 登录后附带小队列表

**文件**：`src/services/auth-service.js`

**改动**：`login` 返回体新增 `squads` 字段。
- 复用 `listMySquads(user.user_id)`，返回该用户在队且未删除的小队
- 用 `try/catch` 兜底：小队表尚未初始化时不阻断登录，`squads` 返回 `[]`

**响应新增字段**：
```json
{
  "code": 0, "success": true, "message": "ok",
  "data": {
    "token": "eyJ...", "user_id": 1, "username": "xxx", "profile": { ... },
    "squads": [ { "squad_id": 1, ... } ]
  }
}
```

---

## 6. 独立「我的小队」接口确认

`GET /api/v1/squads/mine` 已可用，供前端登录后单独获取：
```
GET /api/v1/squads/mine?user_id=5
Authorization: Bearer <token>
```
- `user_id` 优先取 `query.user_id`，缺省回退 Token `user.sub`

---

## 项目当前状态

- **框架**：ES6 Module，零外部依赖，纯 Node.js 内置模块
- **数据库**：MySQL（`mysql2` promise API），含 `unitone` 库
- **鉴权**：JWT（HMAC-SHA256），受保护接口需 `Authorization` 头
- **小队数据表**：`squad`（主键 `squad_id`）、`squad_member`（外键级联）
- **小队接口**：列表 / 详情 / 我的 / 创建 / 加入 / 退出 / 转让队长，均需登录态
- **服务层**：`auth-service`、`activity-service`、`category-service`、`message-service`、`moment-service`、`squad-service`
- **工具层**：`lib/token.js`、`lib/db.js`、`lib/router.js`（新增 `:param` 匹配）、`lib/http.js`