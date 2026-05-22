const crypto = require('node:crypto');
const { COS_TEST, seedActivities } = require('../data/activities');

const activities = seedActivities.map((activity) => ({ ...activity }));

const typeToCategory = {
  运动健身: { category_id: 1, tagText: '约球' },
  演出观赛: { category_id: 2, tagText: '观影' },
  户外出游: { category_id: 3, tagText: '户外' },
  线下聚会: { category_id: 4, tagText: '闲聊' },
  线上活动: { category_id: 6, tagText: '订阅' },
  其他: { category_id: 4, tagText: '其他' },
};

function toPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function normalizeTime(value) {
  const str = String(value || '').trim();
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(str)) return `${str}:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) return str.replace('T', ' ');
  return str;
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function descriptionToParagraphs(description, title) {
  const text = stripHtml(description);
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length) return lines;
  return [
    `欢迎参加「${title}」。`,
    '具体流程与注意事项以后续主办方通知为准。',
  ];
}

function buildFeeNote(price) {
  const raw = String(price ?? '').trim();
  if (!raw || Number(raw) === 0) return '免费';
  return `费用 ¥${raw}/人`;
}

function listActivities(query = {}) {
  let result = [...activities];

  const categoryId = query.category_id || query.categoryId;
  if (categoryId) {
    result = result.filter((item) => Number(item.category_id) === Number(categoryId));
  }

  if (query.tagText) {
    result = result.filter((item) => item.tagText === query.tagText || item.tag_text === query.tagText);
  }

  const keyword = String(query.keyword || query.q || '').trim().toLowerCase();
  if (keyword) {
    result = result.filter((item) => {
      return [item.title, item.location_text, item.org_name, item.tagText]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(keyword));
    });
  }

  const offset = Math.max(Number(query.offset) || 0, 0);
  const limit = toPositiveInt(query.limit, result.length);
  return result.slice(offset, offset + limit);
}

function createActivity(payload = {}) {
  const title = String(payload.title || '').trim();
  if (!title) {
    const error = new Error('Activity title is required');
    error.statusCode = 400;
    throw error;
  }

  const category = typeToCategory[payload.type] || {
    category_id: Number(payload.category_id) || 4,
    tagText: payload.tagText || payload.type || '活动',
  };
  const id = `act-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

  const activity = {
    id,
    category_id: category.category_id,
    name: id,
    isActive: false,
    tagText: category.tagText,
    cover:
      String(payload.cover || '').trim() ||
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80',
    title,
    location_text: String(payload.location || payload.location_text || '').trim() || '待定',
    time_text: normalizeTime(payload.time || payload.time_text),
    fee_note: payload.fee_note || buildFeeNote(payload.price),
    detail_paragraphs: descriptionToParagraphs(payload.description, title),
    org_avatar: payload.org_avatar || `${COS_TEST}/logo.png`,
    org_name: payload.org_name || 'UnitOne 用户',
    joinCount: 0,
    joinAvatars: [],
    createdAt: new Date().toISOString(),
  };

  activities.unshift(activity);
  return activity;
}

module.exports = { createActivity, listActivities };
