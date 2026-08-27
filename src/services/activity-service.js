import { getPool } from '../lib/db.js';
import { GET_ACTIVITY_BY_ID, GET_SQUAD_BY_ID, GET_SQUADS_BY_IDS, INSERT_ACTIVITY, LIST_ACTIVITIES, LIST_ACTIVITIES_BY_SQUAD_IDS, LIST_ACTIVITY_MEMBERS_BY_IDS } from '../db/queries.js';
import { getCategoryById } from './category-service.js';
import { getSquadById } from './squad-service.js';

const COS_TEST = 'https://unitone-1310134019.cos.ap-guangzhou.myqcloud.com/test';

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

function buildFeeNote(price) {
  const raw = String(price ?? '').trim();
  if (!raw || Number(raw) === 0) return '免费';
  return `费用 ¥${raw}/人`;
}

function mapActivity(row) {
  return {
    activity_id: row.activity_id,
    category_id: row.category_id,
    squad_id: row.squad_id,
    title: row.title,
    cover: row.cover,
    tag_text: row.tag_text,
    category_name: row.category_name,
    location_text: row.location_text,
    time_text: row.time_text,
    fee_note: row.fee_note,
    description: row.description,
    org_avatar: row.org_avatar,
    org_name: row.org_name,
    creator_id: row.creator_id,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * 分页查询活动列表（支持筛选 + 关键词搜索）。
 * @param {Object} [query] 查询条件：
 *  - category_id / categoryId {number|string} 按分类 ID 精确筛选（转为数字后参与查询）
 *  - category_name {string} 按分类名称精确筛选
 *  - keyword / q {string} 关键词，对 title、location_text、org_name、category_name 做模糊匹配（忽略大小写）
 *  - offset {number} 分页偏移量，默认 0（负值会被归零）
 *  - limit {number} 每页条数，默认 10（须为大于 0 的整数，否则回退默认值）
 * @returns {Promise<{items: Array<Object>, total: number, hasMore: boolean}>}
 *   - items: mapActivity 处理后的活动对象数组（每条活动额外带出所属小队的 squad_avatar、squad_name）
 *   - total: 符合筛选条件的总记录数（单独执行 COUNT 语句获得）
 *   - hasMore: 是否还有更多数据，判断依据为 `offset + limit < total`
 * @description 先扫描条件动态拼装 WHERE 语句与参数，分别执行 COUNT 和分页查询
 * （避免不必要的关联表查询），通过 mapActivity 归一化行结构；随后对结果中出现的 squad_id
 * 去重批量查询小队（GET_SQUADS_BY_IDS），把头像与名称合并到每条活动上，避免 N+1。
 */
export async function listActivities(query = {}) {
  const pool = getPool();
  const conditions = [];
  const params = [];

  const categoryId = query.category_id || query.categoryId;
  if (categoryId) {
    conditions.push('category_id = ?');
    params.push(Number(categoryId));
  }

  if (query.category_name) {
    conditions.push('category_name = ?');
    params.push(query.category_name);
  }

  const keyword = String(query.keyword || query.q || '').trim().toLowerCase();
  if (keyword) {
    conditions.push('(title LIKE ? OR location_text LIKE ? OR org_name LIKE ? OR category_name LIKE ?)');
    const likePattern = `%${keyword}%`;
    params.push(likePattern, likePattern, likePattern, likePattern);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = Math.max(Number(query.offset) || 0, 0);
  const limit = toPositiveInt(query.limit, 10);

  const countSql = `SELECT COUNT(*) AS total FROM activities ${where}`;
  const [[{ total }]] = await pool.query(countSql, params);

  const sql = LIST_ACTIVITIES.replace('{{where}}', where);
  const [rows] = await pool.query(sql, [...params, limit, offset]);

  // console.log(rows);

  const items = rows.map(mapActivity);

  // 批量带出每条活动所属小队（去重后按 squad_id 一次性查询）的头像与名称，避免 N+1
  const squadIds = [...new Set(items.map((a) => a.squad_id).filter((n) => n > 0))];
  if (squadIds.length) {
    const placeholders = squadIds.map(() => '?').join(',');
    const [squads] = await pool.query(
      GET_SQUADS_BY_IDS.replace('?', placeholders),
      squadIds,
    );
    const squadMap = {};
    for (const s of squads) squadMap[s.squad_id] = s;
    for (const item of items) {
      const squad = squadMap[item.squad_id];
      item.squad_avatar = squad?.squad_avatar ?? '';
      item.squad_name = squad?.squad_name ?? '';
    }
  }

  // 批量带出每条活动的参与成员（含头像）与参与人数，避免 N+1
  const activityIds = items.map((a) => a.activity_id);
  if (activityIds.length) {
    const memberPlaceholders = activityIds.map(() => '?').join(',');
    const [memberRows] = await pool.query(
      LIST_ACTIVITY_MEMBERS_BY_IDS.replace('?', memberPlaceholders),
      activityIds,
    );
    const memberMap = {};
    for (const row of memberRows) {
      if (!memberMap[row.activity_id]) memberMap[row.activity_id] = [];
      memberMap[row.activity_id].push({
        user_id: row.user_id,
        nickname: row.nickname || '',
        avatar: row.avatar || '',
      });
    }
    for (const item of items) {
      const members = memberMap[item.activity_id] || [];
      item.members = members;
      item.member_count = members.length;
    }
  }

  return {
    items,
    total,
    hasMore: offset + limit < total,
  };
}

/**
 * 批量查询多个小队各自的活动，按 squad_id 分组返回。
 * @param {Array<number|string>} [squadIds] 小队 ID 数组；对每个元素做去重、转数字并过滤掉非正整数。
 * @returns {Promise<Object<string, Array<Object>>>} 形如 `{ squad_id: [activity, ...], ... }` 的分组结果；
 * 若入参为空数组或过滤后无有效 ID，直接返回空对象 {}。
 * @description 通过 `IN (...)` 一次性查询所有小队对应的活动（避免对每个小队逐条查询的 N+1 问题），
 * 将结果按 squad_id 归类，每个活动经 mapActivity 归一化后放入对应数组。
 */
export async function listActivitiesBySquads(squadIds = []) {
  if (!Array.isArray(squadIds) || squadIds.length === 0) return {};
  const ids = [...new Set(squadIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length === 0) return {};

  const pool = getPool();
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    LIST_ACTIVITIES_BY_SQUAD_IDS.replace('?', placeholders),
    ids,
  );

  const result = {};
  for (const row of rows) {
    if (!result[row.squad_id]) result[row.squad_id] = [];
    result[row.squad_id].push(mapActivity(row));
  }
  return result;
}

/**
 * 查询单条活动的详情，除活动自身字段外，额外带出所属小队的头像与名称。
 * @param {number|string} activityId 活动 ID，经 toPositiveInt 校验，非正整数抛错。
 * @returns {Promise<Object>} 活动详情对象：
 *  - 活动全部字段（经 mapActivity 归一化）
 *  - 若该活动指定了所属小队（squad_id），额外返回 squad_id 对应小队的 squad_avatar、squad_name
 *    （字段名分别为 squad_avatar、squad_name，覆盖到活动对象上）
 * @throws {Error} 400 —— activityId 非法；404 —— 活动不存在。
 * @description 先按 ID 查询活动记录；若命中且 squad_id 有效，再用 GET_SQUAD_BY_ID 查询所属小队，
 * 取小队头像与名称合并到返回对象中；小队不存在时（如已解散被置空）忽略小队信息。
 */
export async function getActivityDetail(activityId) {
  const id = toPositiveInt(activityId, 0);
  if (!id) {
    const error = new Error(`Invalid activity id: ${activityId}`);
    error.statusCode = 400;
    throw error;
  }

  const pool = getPool();
  const [rows] = await pool.query(GET_ACTIVITY_BY_ID, [id]);
  if (!rows.length) {
    const error = new Error(`Activity not found: ${id}`);
    error.statusCode = 404;
    throw error;
  }

  const activity = mapActivity(rows[0]);

  const squadId = toPositiveInt(activity.squad_id, 0);
  if (squadId) {
    const [squads] = await pool.query(GET_SQUAD_BY_ID, [squadId]);
    const squad = squads[0];
    if (squad) {
      activity.squad_avatar = squad.squad_avatar;
      activity.squad_name = squad.squad_name;
    }
  }

  return activity;
}

/**
 * 创建一条新的活动记录。
 * @param {Object} [payload] 活动数据：
 *  - title {string} 活动标题，必填，去除首尾空格后为空会抛错
 *  - squad_id {number} 活动所属小队，必填（`toPositiveInt` 校验，为 0 时抛错）
 *  - category_id {number} 分类 ID，用于查询对应分类
 *  - cover {string} 封面图，缺省时使用默认 Unsplash 图片
 *  - location / location_text {string} 地点文案，缺省为「待定」
 *  - time / time_text {string} 时间文案，经 normalizeTime 规范化
 *  - price / fee_note {string} 费用说明，缺省时由 buildFeeNote 依据 price 生成（0 或空时为「免费」）
 *  - description, org_avatar, org_name 等其他展示字段（均有缺省值兜底）
 * @param {Object} [user] 当前用户，取 `user.sub` 作为创建人 creator_id。
 * @returns {Promise<Object>} 完整的新建活动对象，包含 activity_id（自增插入结果）、
 * 各展示字段以及 status=0、created_at/updated_at。
 * @throws {Error} 400 —— 标题缺失或 squad_id 未指定；
 * 底层 getCategoryById / getSquadById 校验分类与小队存在，不存在时抛出对应异常
 * （如小队不存在会抛 404）。
 * @description 依据 payload 归一化各展示字段后，通过 INSERT_ACTIVITY 插入一条记录，
 * 传参顺序与查询定义对齐，最终返回完整活动对象。
 */
export async function createActivity(payload = {}, user = {}) {
  console.log(payload);
  console.log(user);
  const title = String(payload.title || '').trim();
  if (!title) {
    const error = new Error('Activity title is required');
    error.statusCode = 400;
    throw error;
  }

  // 创建活动必须指定所属小队
  const squad_id = toPositiveInt(payload.squad_id, 0);
  if (!squad_id) {
    const error = new Error('squad_id 必填：创建活动必须指定所属小队');
    error.statusCode = 400;
    throw error;
  }

  const category = await getCategoryById(payload.category_id);
  await getSquadById(squad_id); // 校验小队存在，不存在则抛 404

  const cover =
    String(payload.cover || '').trim() ||
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80';

  const location_text = String(payload.location || payload.location_text || '').trim() || '待定';
  const time_text = normalizeTime(payload.time || payload.time_text);
  const fee_note = payload.fee_note || buildFeeNote(payload.price);
  const description = String(payload.description || '').trim();
  const org_avatar = payload.org_avatar || `${COS_TEST}/logo.png`;
  const org_name = payload.org_name || 'UnitOne 用户';
  const creator_id = Number(user.sub) || 0;

  const pool = getPool();
  const [result] = await pool.query(INSERT_ACTIVITY, [
    category.category_id,
    squad_id,
    category.category_name,
    cover,
    title,
    location_text,
    time_text,
    fee_note,
    description,
    org_avatar,
    org_name,
    creator_id,
  ]);
  console.log(creator_id);
  return {
    activity_id: result.insertId,
    category_id: category.category_id,
    squad_id,
    title,
    cover,
    category_name: category.category_name,
    location_text,
    time_text,
    fee_note,
    description,
    org_avatar,
    org_name,
    creator_id,
    status: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}