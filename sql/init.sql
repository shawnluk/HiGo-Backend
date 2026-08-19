-- UnitOne Backend Database Initialization
-- Usage: mysql -u root -p < sql/init.sql
-- Or:    mysql -u root -p unitone < sql/init.sql

CREATE DATABASE IF NOT EXISTS unitone
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE unitone;

-- ============================================
-- Activities
-- ============================================

CREATE TABLE IF NOT EXISTS activities (
  activity_id       INT AUTO_INCREMENT PRIMARY KEY,
  category_id       INT          NOT NULL DEFAULT 0,
  is_active         TINYINT(1)   NOT NULL DEFAULT 0,
  tag_text          VARCHAR(50)  NOT NULL DEFAULT '',
  cover             VARCHAR(500) NOT NULL DEFAULT '',
  title             VARCHAR(200) NOT NULL,
  location_text     VARCHAR(500) NOT NULL DEFAULT '',
  time_text         VARCHAR(50)  NOT NULL DEFAULT '',
  fee_note          VARCHAR(200) NOT NULL DEFAULT '',
  org_avatar        VARCHAR(500) NOT NULL DEFAULT '',
  org_name          VARCHAR(100) NOT NULL DEFAULT '',
  join_count        INT          NOT NULL DEFAULT 0,
  detail_paragraphs JSON         NOT NULL,
  join_avatars      JSON         NOT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_category_id (category_id),
  INDEX idx_tag_text (tag_text),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Categories
-- ============================================

CREATE TABLE IF NOT EXISTS activity_categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  type        VARCHAR(50)  NOT NULL,
  tag_text    VARCHAR(50)  NOT NULL DEFAULT '',
  sort_order  INT          NOT NULL DEFAULT 0,

  UNIQUE INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO activity_categories (category_id, type, tag_text, sort_order) VALUES
(1, '运动健身', '约球',   1),
(2, '演出观赛', '观影',   2),
(3, '户外出游', '户外',   3),
(4, '线下聚会', '闲聊',   4),
(6, '线上活动', '订阅',   5),
(5, '文艺手工', '艺术',   6)
ON DUPLICATE KEY UPDATE type = VALUES(type);

-- ============================================
-- Messages
-- ============================================

CREATE TABLE IF NOT EXISTS messages (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  type    VARCHAR(50)  NOT NULL,
  title   VARCHAR(200) NOT NULL,
  content TEXT         NOT NULL,
  time    VARCHAR(50)  NOT NULL DEFAULT '',
  is_read TINYINT(1)   NOT NULL DEFAULT 0,

  INDEX idx_type (type),
  INDEX idx_is_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Moment Posts
-- ============================================

CREATE TABLE IF NOT EXISTS moment_posts (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  avatar         VARCHAR(500) NOT NULL DEFAULT '',
  activity_title VARCHAR(200) NOT NULL DEFAULT '',
  content        TEXT,
  time           VARCHAR(50)  NOT NULL DEFAULT '',
  like_count     INT          NOT NULL DEFAULT 0,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS moment_post_images (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  post_id    INT          NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  image_url  VARCHAR(500) NOT NULL,

  INDEX idx_post_id (post_id),
  CONSTRAINT fk_image_post
    FOREIGN KEY (post_id) REFERENCES moment_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS moment_post_likes (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  post_id  INT          NOT NULL,
  username VARCHAR(100) NOT NULL,

  INDEX idx_post_id (post_id),
  CONSTRAINT fk_like_post
    FOREIGN KEY (post_id) REFERENCES moment_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS moment_post_comments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  post_id    INT          NOT NULL,
  user       VARCHAR(100) NOT NULL,
  text       TEXT         NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_post_id (post_id),
  CONSTRAINT fk_comment_post
    FOREIGN KEY (post_id) REFERENCES moment_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Seed Data: Activities
-- ============================================

INSERT INTO activities (activity_id, category_id, is_active, tag_text, cover, title, location_text, time_text, fee_note, org_avatar, org_name, join_count, detail_paragraphs, join_avatars) VALUES
(1, 1, 0, '约球', 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=900&q=80', '周三晚南山羽毛球局（新手友好）', '深圳市南山区科苑路15号 深圳湾体育中心羽毛球馆', '2026-04-24 19:30:00', '场地费 AA，约 ¥35/人（球拍可租借）', 'https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/logo.png', '阿Ken', 10,
 '["新手友好局，双打轮转为主，现场会简单讲解规则和热身。","请穿运动鞋入场；自带拍或现场租借均可，羽球费用当场分摊。","开始前 15 分钟在场馆入口集合，迟到请在群里说一声方便留位。"]',
 '["https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/flag_007_ll.png","https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/e_000108_r.png","https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/e_000103_r.png"]'),

(2, 1, 0, '约球', 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=900&q=80', '福田5v5篮球夜场（缺2人）', '深圳市福田区福华三路88号 市民中心篮球公园', '2026-04-26 20:00:00', '场地灯光费 AA，约 ¥20/人', 'https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/logo.png', 'Mia篮球手', 10,
 '["全场 5v5，目前还差 2 人锁场，欢迎中等强度球友。","请自备饮用水与毛巾；分队随机抽签，打到闭馆或体力耗尽为止。","雨天若露天场地关闭，会提前 2 小时在群里通知并改期。"]',
 '["https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/flag_007_ll.png","https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/e_000108_r.png","https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/e_000103_r.png"]'),

(3, 2, 0, '观影', 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80', 'IMAX观影《沙丘2》拼单场', '深圳市南山区海德三道85号 万象天地百老汇影城', '2026-04-27 15:10:00', '票价自理（选座后群内同步付款）', 'https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/logo.png', '电影小牧', 11,
 '["已锁定 IMAX 黄金场次，座位尽量挨在一起；开场前 20 分钟取票口集合。","禁止屏摄；观影后可自愿一起去楼下咖啡聊聊剧情。","临时跳车请提前一天说明，方便补位。"]',
 '["https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/flag_007_ll.png","https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/e_000108_r.png","https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/e_000103_r.png"]'),

(4, 3, 0, '户外', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=900&q=80', '梧桐山轻徒步看日落（8km）', '深圳市罗湖区莲塘街道 梧桐山风景名胜区北门', '2026-04-28 14:30:00', '门票与补给自理；建议预算 ¥50 内', 'https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/logo.png', '山野阿泽', 12,
 '["轻度路线约 8km，累计爬升适中，适合有运动习惯的伙伴。","请穿防滑徒步鞋，带够水和帽子；日落时段山顶风大注意保暖。","集合请准时，迟到会在北门牌坊处留人等 10 分钟。"]',
 '["https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/e_000100_r_w.png","https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/e_000102_r_ll.png","https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/e_000109_r.png"]'),

(5, 3, 0, '闲聊', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80', '下班后Coffee Chat：产品x设计交流', '深圳市南山区粤海街道 科技园南区星巴克臻选店', '2026-04-25 19:00:00', '饮品自理', 'https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/logo.png', 'Luna产品喵', 13,
 '["轻松圆桌，产品和设计同学分享近期踩坑与协作心得。","不设固定议程，欢迎带一个问题或一个小案例来聊。","店内座位先到先得，若满座可换隔壁咖啡店继续。"]',
 '["https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/flag_007_ll.png","https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/e_000108_r.png","https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/e_000103_r.png"]'),

(6, 5, 0, '艺术', 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=80', '周末油画体验课：莫兰迪静物', '深圳市福田区华强北街道 深业上城L2 艺术工坊', '2026-04-27 10:00:00', '材料费 ¥128/人（含画布与颜料）', 'https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/logo.png', '木子画室', 14,
 '["零基础友好，老师演示调色与笔触后独立完成一幅静物小画。","画室提供围裙与颜料，建议穿深色上衣以防沾染。","作品可当日带走；如需烘干装裱可现场加购。"]',
 '["https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/e_000100_r_w.png","https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/e_000102_r_ll.png","https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test/e_000109_r.png"]');

-- ============================================
-- Seed Data: Messages
-- ============================================

INSERT INTO messages (id, type, title, content, time, is_read) VALUES
(1, '系统公告', '版本更新通知', 'v2.3.0 已发布，新增夜间模式与消息置顶功能，建议尽快升级体验。', '今天 10:20', 0),
(2, '活动消息', '春季签到活动开启', '连续签到 7 天可领取专属头像框，活动时间截至本周日 24:00。', '今天 08:35', 0),
(3, '账号提醒', '异地登录提醒', '你的账号于昨天 22:17 在新设备登录，如非本人操作请立即修改密码。', '昨天 22:17', 1),
(4, '安全中心', '安全建议', '开启二次验证可进一步保护账号安全，前往设置 > 安全中心开启。', '04-10 16:02', 1);

-- ============================================
-- Seed Data: Moment Posts
-- ============================================

INSERT INTO moment_posts (id, name, avatar, activity_title, content, time, like_count) VALUES
(1, '张三三', 'https://picsum.photos/96/96?random=11', '周末滨江徒步 · 已签到', '活动结束后和大家在江边等日落，风很轻，随便拍了几张都特别出片。', '10 分钟前', 24),
(2, '小红', 'https://picsum.photos/96/96?random=12', '社区绿植工作坊', '工作坊领回来的多肉摆好啦，房间一下子有了生气。', '1 小时前', 8),
(3, '阿杰', 'https://picsum.photos/96/96?random=13', '咖啡品鉴局 · 同城', '打卡活动合作咖啡馆，老板亲手拉的爱心拿铁，全场最佳。', '昨天', 0);

-- Moment post images
INSERT INTO moment_post_images (post_id, sort_order, image_url) VALUES
(1, 0, 'https://picsum.photos/800/800?random=1'),
(1, 1, 'https://picsum.photos/800/800?random=2'),
(1, 2, 'https://picsum.photos/800/800?random=3'),
(2, 0, 'https://picsum.photos/800/800?random=41'),
(2, 1, 'https://picsum.photos/800/800?random=42'),
(2, 2, 'https://picsum.photos/800/800?random=43'),
(2, 3, 'https://picsum.photos/800/800?random=44'),
(3, 0, 'https://picsum.photos/800/800?random=51'),
(3, 1, 'https://picsum.photos/800/800?random=52'),
(3, 2, 'https://picsum.photos/800/800?random=53'),
(3, 3, 'https://picsum.photos/800/800?random=54'),
(3, 4, 'https://picsum.photos/800/800?random=55');

-- Moment post likes
INSERT INTO moment_post_likes (post_id, username) VALUES
(1, '李四'),
(1, '王五'),
(1, '赵六'),
(2, '小明'),
(2, '阿杰');

-- Moment post comments
INSERT INTO moment_post_comments (post_id, user, text) VALUES
(1, '李四', '构图绝了！'),
(1, '王五', '下次活动继续约～'),
(1, '摄影爱好者小陈', '第三张的光影层次太舒服了，想问下是几点拍的？'),
(1, '赵六', '已收藏，周末也去滨江走走。'),
(1, 'Anna', 'So good 👍 求原图当壁纸可以吗'),
(2, '小明', '摆放得好有层次感。'),
(2, '阿杰', '我家那盆怎么养都蔫，求教程！'),
(2, '绿植课代表', '陶粒垫底 + 少浇水多通风，两周浇一次就够啦。'),
(2, '小红', '哈哈课代表上线～'),
(3, '咖啡控_Mike', '这家店豆子偏酸还是偏苦？想冲一波。'),
(3, '阿杰', '偏中深，奶咖很顺滑，手冲可以试日晒。'),
(3, '同城探店酱', '收藏了！下周带朋友去，有没有停车位呀大概多少钱一杯？'),
(3, '路人甲', '爱心拉花满分💯');