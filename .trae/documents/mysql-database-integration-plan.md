# MySQL 数据库接入方案

## Context

当前项目使用内存静态数据（`src/data/*.js` 中的 JS 数组），进程重启后数据重置。需要接入 MySQL 实现数据持久化，同时保持现有 API 接口格式不变。

## 环境变量

在 `src/config.js` 中新增以下配置项：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DB_HOST` | `localhost` | MySQL 主机地址 |
| `DB_PORT` | `3306` | MySQL 端口 |
| `DB_USER` | `root` | 数据库用户名 |
| `DB_PASSWORD` | `""` | 数据库密码 |
| `DB_NAME` | `unitone` | 数据库名称 |

## 表结构设计（8 张表）

### 1. `activities` — 活动主表
- `id` INT AUTO_INCREMENT PRIMARY KEY
- `category_id`, `is_active` (TINYINT), `tag_text`, `cover`, `title`, `location_text`, `time_text`, `fee_note`, `org_avatar`, `org_name`, `join_count`, `created_at`

### 2. `activity_detail_paragraphs` — 活动详情段落（1:N）
- `activity_id` FK → activities(id) ON DELETE CASCADE
- `sort_order`, `content`

### 3. `activity_join_avatars` — 活动参与者头像（1:N）
- `activity_id` FK → activities(id) ON DELETE CASCADE
- `avatar_url`

### 4. `messages` — 消息表
- `id`, `type`, `title`, `content`, `time`, `is_read` (TINYINT)

### 5. `moment_posts` — 动态帖子主表
- `id`, `name`, `avatar`, `activity_title`, `content`, `time`, `like_count`, `created_at`

### 6. `moment_post_images` — 帖子图片（1:N）
- `post_id` FK → moment_posts(id) ON DELETE CASCADE
- `sort_order`, `image_url`

### 7. `moment_post_likes` — 帖子点赞（1:N）
- `post_id` FK → moment_posts(id) ON DELETE CASCADE
- `username`

### 8. `moment_post_comments` — 帖子评论（1:N）
- `post_id` FK → moment_posts(id) ON DELETE CASCADE
- `user`, `text`, `created_at`

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `package.json` | 修改 | 添加 `mysql2` 依赖 |
| `src/config.js` | 修改 | 新增 DB_* 环境变量读取 |
| `src/lib/db.js` | **新建** | 连接池单例（initPool / getPool / closePool） |
| `src/server.js` | 修改 | 启动时初始化连接池，关闭时释放 |
| `src/services/activity-service.js` | 修改 | 替换数组操作为 MySQL 查询（批量查询避免 N+1） |
| `src/services/message-service.js` | 修改 | 替换数组过滤为 MySQL SELECT |
| `src/services/moment-service.js` | 修改 | 替换数组过滤为 MySQL 批量查询 |
| `sql/init.sql` | **新建** | 建表 DDL + 种子数据 INSERT |
| `src/services/auth-service.js` | 不变 | 登录不依赖数据库 |
| `src/routes/*.js` | 不变 | 路由层无需改动 |

## 关键技术决策

1. **批量查询避免 N+1**：先查主表，收集 ID，再批量查子表（`WHERE id IN (?)`）
2. **连接池单例**：通过 `getPool()` 获取，服务函数签名不变，路由零改动
3. **布尔值映射**：MySQL TINYINT(1) ↔ JS Boolean，在 service 层转换
4. **字段名映射**：`snake_case`（DB）↔ `camelCase`（API），在 service 层统一转换
5. **`time` 字段保留 VARCHAR**：种子数据使用相对时间字符串（如"10 分钟前"），保持原样

## 实施步骤

1. 安装 `mysql2`：`npm install mysql2`
2. 创建 `src/lib/db.js`（连接池模块）
3. 修改 `src/config.js`（新增 DB 配置）
4. 修改 `src/server.js`（初始化/关闭连接池）
5. 创建 `sql/init.sql`（建表 + 种子数据）
6. 执行 SQL 脚本初始化数据库
7. 改造 `message-service.js`（最简单，单表）
8. 改造 `activity-service.js`（主表 + 2 子表 + 创建功能）
9. 改造 `moment-service.js`（主表 + 3 子表）
10. 验证：启动服务，测试所有 API 接口

## 验证方式

1. 确保本地 MySQL 服务运行
2. 创建数据库：`mysql -u root -e "CREATE DATABASE IF NOT EXISTS unitone CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"`
3. 导入表结构和数据：`mysql -u root unitone < sql/init.sql`
4. 设置环境变量后启动服务：`DB_NAME=unitone npm run dev`
5. 测试接口：
   - `curl http://localhost:3000/api/v1/activities`
   - `curl http://localhost:3000/api/v1/activities?category_id=1`
   - `curl -X POST http://localhost:3000/api/v1/activities -H "Content-Type: application/json" -d '{"title":"测试活动","type":"运动健身"}'`
   - `curl http://localhost:3000/api/v1/messages`
   - `curl http://localhost:3000/api/v1/moment/posts`