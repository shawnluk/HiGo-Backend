# 会话日志 - 2026-08-26

## 1. 活动表关联小队：新增 squad_id 字段

**说明**：活动与小队的关系为「每活动只属于一个小队，一个小队可拥有多个活动」。在 `activities` 表新增 `squad_id` 列，关联 `squad` 表。

**修改文件**：
- `sql/init.sql` — `activities` 建表语句新增 `squad_id`、`idx_squad_id` 索引、外键 `fk_activity_squad`
- `src/db/queries.js` — `INSERT_ACTIVITY` 插入语句加入 `squad_id`
- `src/services/activity-service.js` — `mapActivity` 返回 `squad_id`；`createActivity` 从 `payload.squad_id` 解析并落库

**字段/约束**：
```
squad_id  INT NULL  → 一个活动只属于一个小队
INDEX idx_squad_id (squad_id)
FOREIGN KEY fk_activity_squad REFERENCES squad(squad_id) ON DELETE SET NULL
```
- `ON DELETE SET NULL`：小队解散时活动保留、关联清空

**对存量库需执行**：
```sql
ALTER TABLE unitone.activities
  ADD COLUMN squad_id INT NULL COMMENT '关联的小队 squad_id，一个活动只属于一个小队' AFTER category_id,
  ADD INDEX idx_squad_id (squad_id);
```

---

## 2. 创建活动必须指定小队

**文件**：`src/services/squad-service.js`、`src/services/activity-service.js`

- `squad_id` 改为**必填**：缺失或非法返回 `400 squad_id 必填：创建活动必须指定所属小队`
- 新增轻量校验 `getSquadById()`（只查单条 `squad`、不查成员），不存在返回 404；替代原先会查成员列表的 `getSquadDetail()`，避免多余查询
- 真正执行 `INSERT_ACTIVITY` 落库（此前该插入被注释、仅返回假数据）

---

## 3. 登录附带小队角色 member_role

**说明**：登录返回的 `squads` 中，每个小队对象新增 `member_role` 字段。

**修改文件**：
- `src/db/queries.js` — `LIST_MY_SQUADS` 增查 `sm.member_role`
- `src/services/squad-service.js` — `mapSquad` 返回 `member_role`（缺省 `1`）

**`member_role` 取值**：`0`=队长、`1`=普通成员、`2`=副队长

```json
{
  "squads": [ { "squad_id": 3, "name": "...", "member_role": 0 } ]
}
```

---

## 4. 登录附带各小队活动总数 activity_count

**说明**：登录拿到我的小队后，按 `squad_id` 统计各小队对应的活动总数，纳入 `squads` 一并返回。

**修改文件**：
- `src/services/squad-service.js`（**归口**）— 新增 `countActivitiesBySquads(squadIds)`，用 `GROUP BY squad_id` 一次批量统计，避免 N+1
- `src/services/auth-service.js` — 登录时调用 `countActivitiesBySquads`，以 `activity_count` 合并进每个小队

**说明**：该统计逻辑按用户要求统一写在 `squad-service.js`，`auth-service` 从 `./squad-service.js` 引入；最初在 `activity-service.js` 中的实现已移除。

```json
{
  "squads": [ { "squad_id": 3, "member_role": 0, "activity_count": 5 } ]
}
```
`activity_count` 为 `activities` 表中 `squad_id` 等于该小队的活动记录数，无活动时为 `0`。

---

## 项目当前状态

- **框架**：ES6 Module，零外部依赖，纯 Node.js 内置模块
- **数据库**：MySQL（`mysql2` promise API），含 `unitone` 库
- **鉴权**：JWT（HMAC-SHA256），受保护接口需 `Authorization` 头
- **小队数据表**：`squad`（主键 `squad_id`）、`squad_member`（小队员，含 `member_role`）
- **活动表**：`activities` 已具备 `squad_id` 关联小队（待对存量库执行 ALTER）
- **登录返回**：`token`、`user_id`、`username`、`profile`、`squads`（含 `member_role`、`activity_count`）
- **服务层**：`auth-service`、`activity-service`、`category-service`、`message-service`、`moment-service`、`squad-service`
- **工具层**：`lib/token.js`、`lib/db.js`、`lib/router.js`（支持 `:param` 匹配）、`lib/http.js`