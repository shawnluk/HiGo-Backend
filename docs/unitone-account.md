#### 用户基本信息表 `users`

| field         | type         | comment    |
| ------------- | ------------ | ---------- |
| id            | bigint       | pk         |
| username      | varchar(50)  | 用户名     |
| password_hash | varchar(128) | 密码哈希   |
| salt          | varchar(128) | 密码盐值   |
| avatar        | varchar      | 用户头像   |
| gender        | smallint     | 性别       |
| birth         | date         | 出生日期   |
| email         | varchar      | 电子邮件   |
| phone         | varchar(15)  | 电话号码   |
| user_type     | varchar(20)  | 用户类型   |
| create_time   | bigint       | 创建时间   |
| update_time   | bigint       | 更新时间   |
| status        | smallint     | 状态       |
| deleted       | boolean      | 是否已删除 |
| delete_id     | bigint       | 删除ID     |

联合唯一约束:
 (`phone`, `delete_id`)
 其中`delete_id`字段是为了解决用户逻辑删除之后导致唯一约束冲突的问题

#### 用户扩展信息表 `user_extents`

| field               | type        | comment                  |
| ------------------- | ----------- | ------------------------ |
| id                  | bigint      | pk                       |
| user_id             | bigint      | 用户ID                   |
| introduce           | varchar(50) | 简介                     |
| is_realname         | boolean     | 是否实名                 |
| realname            | varchar(50) | 真实姓名                 |
| last_login_ip       | varchar(40) | 最后登录IP               |
| last_login_address  | varchar     | 最后登录地址             |
| last_login_time     | integer     | 最后登录时间             |
| last_login_type     | varchar(32) | 最后登录类型             |
| create_time         | integer     | 创建时间                 |
| update_time         | integer     | 更新时间                 |
| device_id           | varchar     | 设备ID                   |
| last_username_utime | integer     | 最近一次用户名更新的时间 |



活动创建表



