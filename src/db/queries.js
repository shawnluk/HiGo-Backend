// ============================================
// Activities
// ============================================

// 分页查询活动列表，{{where}} 由业务层替换为筛选条件，按创建时间升序
export const LIST_ACTIVITIES = `
  SELECT * FROM activities
  {{where}}
  ORDER BY created_at ASC
  LIMIT ? OFFSET ?
`;

// 按 ID 查询单条活动记录，用于活动详情
export const GET_ACTIVITY_BY_ID = `
  SELECT * FROM activities
  WHERE activity_id = ?
`;

// 新增一条活动记录，status 默认 0（待发布）
export const INSERT_ACTIVITY = `
  INSERT INTO activities
    (category_id, squad_id, category_name, cover, title, location_text, time_text, fee_note, description, org_avatar, org_name, creator_id, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
`;

// 批量查询多个活动的参与成员（含昵称、头像），IN (?) 由调用方展开；
// 仅取 member_status=1 的在参加成员，并 LEFT JOIN user_profiles 带出资料头像
export const LIST_ACTIVITY_MEMBERS_BY_IDS = `
  SELECT am.activity_id, am.user_id, up.nickname, up.avatar
  FROM activity_member am
  LEFT JOIN user_profiles up ON up.user_id = am.user_id
  WHERE am.activity_id IN (?)
    AND am.member_status = 1
  ORDER BY am.activity_id, am.id
`;

// ============================================
// Categories
// ============================================

// 查询全部分类，按 sort_order 排序
export const LIST_CATEGORIES = `
  SELECT *
  FROM activity_categories
  ORDER BY sort_order
`;

// ============================================
// Users
// ============================================

// 按用户名查询用户的登录凭据（含密码哈希，用于注册查重与登录鉴权）
export const FIND_USER_BY_USERNAME = `
  SELECT user_id, username, password_hash
  FROM users
  WHERE username = ?
`;

// 创建用户账号记录
export const INSERT_USER = `
  INSERT INTO users (username, password_hash)
  VALUES (?, ?)
`;

// 为用户创建对应资料记录，register_time 取当前时间
export const INSERT_USER_PROFILE = `
  INSERT INTO user_profiles (user_id, nickname, avatar, register_time)
  VALUES (?, ?, ?, NOW())
`;

// 按用户 ID 查询完整资料信息，用于登录/详情返回
export const FIND_USER_PROFILE_BY_ID = `
  SELECT user_id, user_no, nickname, real_name, identity_card, avatar, gender,
         birthday, user_status, user_type, last_login_time, register_time, update_time, is_deleted
  FROM user_profiles
  WHERE user_id = ?
`;

// ============================================
// Messages
// ============================================

// 查询消息列表，{{where}} 由业务层替换筛选条件，按 id 倒序
export const LIST_MESSAGES = `
  SELECT * FROM messages
  {{where}}
  ORDER BY id DESC
`;

// ============================================
// Moment Posts
// ============================================

// 分页查询动态列表，{{where}} 由业务层替换筛选条件，按创建时间倒序
// LEFT JOIN user_profiles 带出发布人昵称/头像，LEFT JOIN activities 带出关联活动标题
export const LIST_MOMENT_POSTS = `
  SELECT
    mp.id, mp.user_id, mp.activity_id, mp.content, mp.created_at,
    up.nickname, up.avatar,
    a.title AS activity_title
  FROM moment_posts mp
  LEFT JOIN user_profiles up ON up.user_id = mp.user_id
  LEFT JOIN activities a ON a.activity_id = mp.activity_id
  {{where}}
  ORDER BY mp.created_at DESC
  LIMIT ? OFFSET ?
`;

// 批量查询多条动态的图片，IN (?) 由调用方展开为占位符
export const BATCH_POST_IMAGES = `
  SELECT post_id, image_url
  FROM moment_post_images
  WHERE post_id IN (?)
  ORDER BY post_id, sort_order
`;

// 批量查询多条动态的点赞用户（含点赞者 user_id 与昵称），LEFT JOIN user_profiles 带出实时昵称
export const BATCH_POST_LIKES = `
  SELECT ml.post_id, ml.user_id, up.nickname AS username
  FROM moment_post_likes ml
  LEFT JOIN user_profiles up ON up.user_id = ml.user_id
  WHERE ml.post_id IN (?)
`;

// 批量查询多条动态的评论（评论人昵称、文本），按动态与创建时间排序
export const BATCH_POST_COMMENTS = `
  SELECT mc.post_id, up.nickname AS \`user\`, mc.text
  FROM moment_post_comments mc
  LEFT JOIN user_profiles up ON up.user_id = mc.user_id
  WHERE mc.post_id IN (?)
  ORDER BY mc.post_id, mc.created_at
`;

// 新建一条动态，返回自增 id
export const INSERT_MOMENT_POST = `
  INSERT INTO moment_posts (user_id, activity_id, content)
  VALUES (?, ?, ?)
`;

// 为动态插入一张图片
export const INSERT_MOMENT_IMAGE = `
  INSERT INTO moment_post_images (post_id, sort_order, image_url)
  VALUES (?, ?, ?)
`;

// 按 ID 查询单条动态（存在性 / 归属校验）
export const FIND_MOMENT_POST_BY_ID = `
  SELECT id, user_id, activity_id, content, created_at
  FROM moment_posts WHERE id = ?
`;

// 删除动态（其图片 / 点赞 / 评论经外键 ON DELETE CASCADE 级联删除）
export const DELETE_MOMENT_POST = `
  DELETE FROM moment_posts WHERE id = ?
`;

// 点赞（INSERT IGNORE 保证同一用户同一动态只点赞一次）
export const INSERT_MOMENT_LIKE = `
  INSERT IGNORE INTO moment_post_likes (post_id, user_id)
  VALUES (?, ?)
`;

// 取消点赞
export const DELETE_MOMENT_LIKE = `
  DELETE FROM moment_post_likes WHERE post_id = ? AND user_id = ?
`;

// 查询某用户是否已点赞某条动态
export const FIND_MOMENT_LIKE = `
  SELECT id FROM moment_post_likes WHERE post_id = ? AND user_id = ?
`;

// 新增评论
export const INSERT_MOMENT_COMMENT = `
  INSERT INTO moment_post_comments (post_id, user_id, text)
  VALUES (?, ?, ?)
`;

// 按 ID 查询评论归属（作者校验）
export const FIND_MOMENT_COMMENT_BY_ID = `
  SELECT id, post_id, user_id FROM moment_post_comments WHERE id = ?
`;

// 删除评论（仅作者本人）
export const DELETE_MOMENT_COMMENT = `
  DELETE FROM moment_post_comments WHERE id = ? AND user_id = ?
`;

// ============================================
// Squads
// ============================================

// 分页查询未解散小队列表，{{where}} 由业务层替换筛选条件，按创建时间倒序
export const LIST_SQUADS = `
  SELECT * FROM squad
  WHERE delete_flag = 0 {{where}}
  ORDER BY create_time DESC
  LIMIT ? OFFSET ?
`;

// 统计未解散小队总数，用于分页
export const COUNT_SQUADS = `
  SELECT COUNT(*) AS total FROM squad
  WHERE delete_flag = 0 {{where}}
`;

// 批量查询多个小队的头像与名称，IN (?) 由调用方展开
export const GET_SQUADS_BY_IDS = `
  SELECT squad_id, squad_name, squad_avatar
  FROM squad
  WHERE squad_id IN (?) AND delete_flag = 0
`;

// 按 ID 查询单个未解散小队，用于校验与详情
export const GET_SQUAD_BY_ID = `
  SELECT * FROM squad
  WHERE squad_id = ? AND delete_flag = 0
`;

// 查询某小队在队成员列表，按角色（队长优先）与加入时间排序
export const LIST_SQUAD_MEMBERS = `
  SELECT * FROM squad_member
  WHERE squad_id = ? AND member_status = 1
  ORDER BY member_role ASC, join_time ASC
`;

// 批量查询多个用户的资料摘要（昵称、头像），IN (?) 由调用方展开
export const LIST_USER_PROFILES_BY_IDS = `
  SELECT user_id, nickname, avatar
  FROM user_profiles
  WHERE user_id IN (?)
`;

// 新建小队记录，delete_flag 默认 0（未解散）
export const INSERT_SQUAD = `
  INSERT INTO squad
    (squad_name, squad_avatar, captain_id, vice_captain_id, intro, category_id,
     max_members, member_count, join_type, status, invite_code, delete_flag)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
`;

// 将用户加入小队并写入成员记录，member_status 默认 1（在队）、时间取当前时间
export const INSERT_SQUAD_MEMBER = `
  INSERT INTO squad_member
    (squad_id, user_id, member_role, member_status, join_time, remark, create_time, update_time)
  VALUES (?, ?, ?, 1, NOW(), ?, NOW(), NOW())
`;

// 按小队与用户查询成员记录，用于存在性/角色/状态判断
export const FIND_SQUAD_MEMBER = `
  SELECT * FROM squad_member
  WHERE squad_id = ? AND user_id = ?
`;

// 已退队的用户重新加入：恢复在队状态、重置加入时间并清除退队时间
export const REJOIN_SQUAD_MEMBER = `
  UPDATE squad_member
  SET member_status = 1, join_time = NOW(), quit_time = NULL, update_time = NOW()
  WHERE squad_id = ? AND user_id = ?
`;

// 用户退出小队：置为离队状态并记录退队时间
export const LEAVE_SQUAD_MEMBER = `
  UPDATE squad_member
  SET member_status = 0, quit_time = NOW(), update_time = NOW()
  WHERE squad_id = ? AND user_id = ?
`;

// 小队成员数 +1，仅当未满员时生效（member_count < max_members），用于并发安全地拦截满员加入
export const INC_SQUAD_MEMBER_COUNT = `
  UPDATE squad
  SET member_count = member_count + 1
  WHERE squad_id = ? AND member_count < max_members
`;

// 小队成员数 -1，仅当成员数 > 0 时生效（避免负数）
export const DEC_SQUAD_MEMBER_COUNT = `
  UPDATE squad
  SET member_count = member_count - 1
  WHERE squad_id = ? AND member_count > 0
`;

// 查询用户加入（在队且未解散）的全部小队，并附带该用户在队内的角色，按创建时间倒序
export const LIST_MY_SQUADS = `
  SELECT s.*, sm.member_role
  FROM squad s
  JOIN squad_member sm ON sm.squad_id = s.squad_id
  WHERE sm.user_id = ? AND sm.member_status = 1 AND s.delete_flag = 0
  ORDER BY s.create_time DESC
`;

// 批量查询一间或多间小队的活动（IN (?) 由调用方展开），按小队与创建时间排序
export const LIST_ACTIVITIES_BY_SQUAD_IDS = `
  SELECT * FROM activities
  WHERE squad_id IN (?)
  ORDER BY squad_id, created_at ASC
`;

// 修改某成员在小队中的角色（0=队长 1=普通成员 2=副队长）
export const SET_MEMBER_ROLE = `
  UPDATE squad_member
  SET member_role = ?, update_time = NOW()
  WHERE squad_id = ? AND user_id = ?
`;

// 更新小队的队长 ID（用于转让队长）
export const UPDATE_SQUAD_CAPTAIN = `
  UPDATE squad
  SET captain_id = ?, update_time = NOW()
  WHERE squad_id = ?
`;