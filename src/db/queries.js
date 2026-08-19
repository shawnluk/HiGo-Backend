// ============================================
// Activities
// ============================================

export const LIST_ACTIVITIES = `
  SELECT * FROM activities
  {{where}}
  ORDER BY created_at DESC
  LIMIT ? OFFSET ?
`;

export const INSERT_ACTIVITY = `
  INSERT INTO activities
    (category_id, is_active, tag_text, cover, title, location_text, time_text, fee_note, org_avatar, org_name, join_count, detail_paragraphs, join_avatars)
  VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
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