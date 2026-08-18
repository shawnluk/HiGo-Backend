import { seedMomentPosts } from '../data/moment-posts.js';

const posts = seedMomentPosts.map((post) => ({ ...post }));

export function listMomentPosts(query = {}) {
  let result = [...posts];
  const keyword = String(query.keyword || query.q || '').trim().toLowerCase();

  if (keyword) {
    result = result.filter((post) => {
      return [post.name, post.activityTitle, post.content]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(keyword));
    });
  }

  const offset = Math.max(Number(query.offset) || 0, 0);
  const limit = Number(query.limit) > 0 ? Number(query.limit) : result.length;
  return result.slice(offset, offset + limit);
}