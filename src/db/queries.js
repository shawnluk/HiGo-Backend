// ============================================
// Activities
// ============================================

export const LIST_ACTIVITIES = `
  SELECT * FROM activities
  {{where}}
  ORDER BY created_at ASC
  LIMIT ? OFFSET ?
`;

export const INSERT_ACTIVITY = `
  INSERT INTO activities
    (category_id, category_name, cover, title, location_text, time_text, fee_note, description, org_avatar, org_name, creator_id, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
`;

// ============================================
// Categories
// ============================================

export const LIST_CATEGORIES = `
  SELECT *
  FROM activity_categories
  ORDER BY sort_order
`;

// ============================================
// Users
// ============================================

export const FIND_USER_BY_USERNAME = `
  SELECT user_id, username, password_hash
  FROM users
  WHERE username = ?
`;

export const INSERT_USER = `
  INSERT INTO users (username, password_hash)
  VALUES (?, ?)
`;

export const INSERT_USER_PROFILE = `
  INSERT INTO user_profiles (user_id, nickname, avatar, register_time)
  VALUES (?, ?, ?, NOW())
`;

export const FIND_USER_PROFILE_BY_ID = `
  SELECT user_id, user_no, nickname, real_name, identity_card, avatar, gender,
         birthday, user_status, user_type, last_login_time, register_time, update_time, is_deleted
  FROM user_profiles
  WHERE user_id = ?
`;

// ============================================
// Messages
// ============================================

export const LIST_MESSAGES = `
  SELECT * FROM messages
  {{where}}
  ORDER BY id DESC
`;

// ============================================
// Moment Posts
// ============================================

export const LIST_MOMENT_POSTS = `
  SELECT * FROM moment_posts
  {{where}}
  ORDER BY created_at DESC
  LIMIT ? OFFSET ?
`;

export const BATCH_POST_IMAGES = `
  SELECT post_id, image_url
  FROM moment_post_images
  WHERE post_id IN (?)
  ORDER BY post_id, sort_order
`;

export const BATCH_POST_LIKES = `
  SELECT post_id, username
  FROM moment_post_likes
  WHERE post_id IN (?)
`;

export const BATCH_POST_COMMENTS = `
  SELECT post_id, user, text
  FROM moment_post_comments
  WHERE post_id IN (?)
  ORDER BY post_id, created_at
`;