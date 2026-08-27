import { getPool } from '../lib/db.js';
import {
  LIST_SQUADS,
  COUNT_SQUADS,
  GET_SQUAD_BY_ID,
  LIST_SQUAD_MEMBERS,
  LIST_USER_PROFILES_BY_IDS,
  INSERT_SQUAD,
  INSERT_SQUAD_MEMBER,
  FIND_SQUAD_MEMBER,
  REJOIN_SQUAD_MEMBER,
  LEAVE_SQUAD_MEMBER,
  INC_SQUAD_MEMBER_COUNT,
  DEC_SQUAD_MEMBER_COUNT,
  LIST_MY_SQUADS,
  SET_MEMBER_ROLE,
  UPDATE_SQUAD_CAPTAIN,
} from '../db/queries.js';

function toPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

// member_role: 0=队长, 2=副队长, 1=普通成员
function mapSquad(row) {
  return {
    squad_id: row.squad_id,
    name: row.squad_name,
    avatar: row.squad_avatar,
    captain_id: row.captain_id,
    vice_captain_id: row.vice_captain_id,
    member_role: row.member_role ?? 1,
    intro: row.intro,
    category_id: row.category_id,
    max_members: row.max_members,
    member_count: row.member_count,
    join_type: row.join_type,
    status: row.status,
    invite_code: row.invite_code,
    create_time: row.create_time,
    update_time: row.update_time,
  };
}

function mapMember(row) {
  return {
    id: row.id,
    squad_id: row.squad_id,
    user_id: row.user_id,
    role: row.member_role,
    status: row.member_status,
    join_time: row.join_time,
    quit_time: row.quit_time,
    remark: row.remark,
  };
}

/**
 * 分页查询小队列表（支持筛选 + 关键词搜索）。
 * @param {Object} [query] 查询条件：
 *  - category_id / categoryId {number|string} 按分类 ID 精确筛选
 *  - join_type / joinType {number|string} 按加入方式（入队类型）筛选，非空时才生效
 *  - keyword / q {string} 关键词，对 squad_name、intro 做模糊匹配（忽略大小写）
 *  - offset {number} 分页偏移量，默认 0（负值归零）
 *  - limit {number} 每页条数，默认 10（须为大于 0 的整数，否则回退默认值）
 * @returns {Promise<{items: Array<Object>, total: number, hasMore: boolean}>}
 *   - items: mapSquad 处理后的小队对象数组
 *   - total: 符合条件的总记录数（单独执行 COUNT 获得）
 *   - hasMore: 是否还有更多数据，判断依据 `offset + limit < total`
 * @description 动态拼装条件并分别执行 COUNT 与分页查询，行经 mapSquad 归一化
 * （含 member_role 等字段，角色含义见 mapSquad 顶部注释）。
 */
export async function listSquads(query = {}) {
  const pool = getPool();
  const conditions = [];
  const params = [];

  const categoryId = query.category_id || query.categoryId;
  if (categoryId) {
    conditions.push('category_id = ?');
    params.push(Number(categoryId));
  }

  const joinType = query.join_type || query.joinType;
  if (joinType !== undefined && joinType !== null && joinType !== '') {
    conditions.push('join_type = ?');
    params.push(Number(joinType));
  }

  const keyword = String(query.keyword || query.q || '').trim().toLowerCase();
  if (keyword) {
    conditions.push('(squad_name LIKE ? OR intro LIKE ?)');
    const like = `%${keyword}%`;
    params.push(like, like);
  }

  const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';
  const offset = Math.max(Number(query.offset) || 0, 0);
  const limit = toPositiveInt(query.limit, 10);

  const countSql = COUNT_SQUADS.replace('{{where}}', where);
  const [[{ total }]] = await pool.query(countSql, params);

  const sql = LIST_SQUADS.replace('{{where}}', where);
  const [rows] = await pool.query(sql, [...params, limit, offset]);

  return {
    items: rows.map(mapSquad),
    total,
    hasMore: offset + limit < total,
  };
}

/**
 * 根据 ID 查询单个小队的基础信息（不含成员与活动列表）。
 * @param {number|string} squadId 小队 ID，经 toPositiveInt 校验，非正整数时抛错。
 * @returns {Promise<Object>} 经 mapSquad 归一化的小队对象。
 * @throws {Error} 400 —— squadId 非法（非正整数）；404 —— 小队不存在。
 * @description 依据 ID 执行单行查询，命中后由 mapSquad 映射字段返回。
 */
export async function getSquadById(squadId) {
  const id = toPositiveInt(squadId, 0);
  if (!id) {
    const error = new Error(`Invalid squad id: ${squadId}`);
    error.statusCode = 400;
    throw error;
  }

  const pool = getPool();
  const [rows] = await pool.query(GET_SQUAD_BY_ID, [id]);
  if (!rows.length) {
    const error = new Error(`Squad not found: ${id}`);
    error.statusCode = 404;
    throw error;
  }
  return mapSquad(rows[0]);
}

/**
 * 查询小队详情（基础信息 + 成员列表 + 活动列表）。
 * @param {number|string} squadId 小队 ID，经 toPositiveInt 校验，非正整数抛错。
 * @returns {Promise<Object & {members: Array<Object>, activities: Array<Object>}>}
 *   在小队基础信息上扩展出：
 *   - members: 该小队在队成员数组（经 mapMember 归一化，并带出 nickname/avatar 资料）
 *   - activities: 该小队活动数组（经 listActivitiesBySquads 批量查询获得）
 * @throws {Error} 400 —— squadId 非法；404 —— 小队不存在。
 * @description 先查小队基础行，再查成员列表；活动部分为避免循环依赖，使用动态 `import()`
 * 延迟引入 activity-service，即使活动查询失败也会被 try/catch 捕获并忽略（返回空数组），
 * 不影响成员信息的正常返回。
 */
export async function getSquadDetail(squadId) {
  const id = toPositiveInt(squadId, 0);
  if (!id) {
    const error = new Error(`Invalid squad id: ${squadId}`);
    error.statusCode = 400;
    throw error;
  }

  const pool = getPool();
  const [rows] = await pool.query(GET_SQUAD_BY_ID, [id]);
  if (!rows.length) {
    const error = new Error(`Squad not found: ${id}`);
    error.statusCode = 404;
    throw error;
  }

  const [members] = await pool.query(LIST_SQUAD_MEMBERS, [id]);

  // 批量按 user_id 拉取成员资料（昵称、头像），并合并到成员对象上
  const memberList = members.map(mapMember);
  const userIds = [...new Set(memberList.map((m) => m.user_id).filter((n) => n > 0))];
  if (userIds.length) {
    const placeholders = userIds.map(() => '?').join(',');
    const [profiles] = await pool.query(
      LIST_USER_PROFILES_BY_IDS.replace('?', placeholders),
      userIds,
    );
    const profileByUserId = {};
    for (const p of profiles) profileByUserId[p.user_id] = p;
    for (const member of memberList) {
      const profile = profileByUserId[member.user_id];
      member.nickname = profile?.nickname ?? '';
      member.avatar = profile?.avatar ?? '';
    }
  }

  // 查询该小队的全部活动
  let activities = [];
  try {
    const { listActivitiesBySquads } = await import('./activity-service.js');
    activities = (await listActivitiesBySquads([id]))[id] || [];
  } catch {
    // 忽略活动查询失败，避免影响成员信息返回
  }

  return {
    ...mapSquad(rows[0]),
    members: memberList,
    activities,
  };
}

/**
 * 校验用户是否具备访问/操作小队内部资源的权限（成员归属校验）。
 * @param {number|string} squadId 小队 ID。
 * @param {Object} [user] 当前用户，取 `user.sub`（无则回退 `user.user_id`）作为 userId。
 * @returns {Promise<void>} 校验通过时不作任何返回（成功放行）。
 * @throws {Error}
 *   - 400 —— squadId 非法；
 *   - 401 —— 未能解析出登录用户 ID（请先登录）；
 *   - 404 —— 小队不存在；
 *   - 403 —— 用户既不是队长、也不是小队中状态有效的成员。
 * @description 权限规则：队长直接放行；否则查询该用户在队中的记录，
 * 必须存在且 member_status === 1（在队）才放行，否则抛 403。
 */
export async function assertSquadMemberAccess(squadId, user = {}) {
  const id = toPositiveInt(squadId, 0);
  const userId = toPositiveInt(user.sub, toPositiveInt(user.user_id, 0));
  if (!id) {
    const error = new Error(`Invalid squad id: ${squadId}`);
    error.statusCode = 400;
    throw error;
  }
  if (!userId) {
    const error = new Error('请先登录');
    error.statusCode = 401;
    throw error;
  }

  const pool = getPool();
  const [rows] = await pool.query(GET_SQUAD_BY_ID, [id]);
  if (!rows.length) {
    const error = new Error(`Squad not found: ${id}`);
    error.statusCode = 404;
    throw error;
  }

  // 队长直接放行
  if (Number(rows[0].captain_id) === userId) return;

  const [members] = await pool.query(FIND_SQUAD_MEMBER, [id, userId]);
  const member = members[0];
  if (!member || Number(member.member_status) !== 1) {
    const error = new Error('无权访问该小队，仅队长或小队成员可查看');
    error.statusCode = 403;
    throw error;
  }
}

/**
 * 创建一个小队，队长（和可选副队长）作为初始成员一并写入。
 * @param {Object} [payload] 小队数据：
 *  - name / squad_name {string} 小队名称，必填，去首尾空格后为空抛错
 *  - captain_id {number} 队长 ID，缺省时取 `user.sub`
 *  - vice_captain_id {number|null} 副队长 ID，为 null 时可不填（缺省填 null 即不设副队长）
 *  - avatar / squad_avatar, intro, category_id, invite_code 等基础字段
 *  - max_members {number} 人数上限，默认 20
 *  - join_type {number} 加入方式，默认 0；status 默认 1
 * @param {Object} [user] 当前用户，提供 `user.sub` 作为默认队长。
 * @returns {Promise<Object>} 新建小队对象，含 squad_id（insertId）以及各字段与
 * create_time/update_time。
 * @throws {Error} 400 —— 名称缺失。
 * @description 先 INSERT_SQUAD 插入小队行（member_count 依据 captainId 置 1 或 0），
 * 随后将队长（role=0，备注「创建小队」）与可选副队长（role=2）作为成员写入成员表，
 * 最后返回完整小队对象。
 */
export async function createSquad(payload = {}, user = {}) {
  const pool = getPool();
  const name = String(payload.name || payload.squad_name || '').trim();
  if (!name) {
    const error = new Error('Squad name is required');
    error.statusCode = 400;
    throw error;
  }

  const captainId = toPositiveInt(payload.captain_id, Number(user.sub) || 0);
  const viceCaptainId =
    payload.vice_captain_id != null ? toPositiveInt(payload.vice_captain_id, 0) : null;

  const squad = {
    squad_name: name,
    squad_avatar: String(payload.avatar || payload.squad_avatar || '').trim(),
    captain_id: captainId,
    vice_captain_id: viceCaptainId,
    intro: String(payload.intro || '').trim(),
    category_id: toPositiveInt(payload.category_id, 0),
    max_members: toPositiveInt(payload.max_members, 20),
    member_count: captainId ? 1 : 0,
    join_type: payload.join_type != null ? Number(payload.join_type) : 0,
    status: payload.status != null ? Number(payload.status) : 1,
    invite_code: String(payload.invite_code || '').trim(),
  };

  const [result] = await pool.query(
    INSERT_SQUAD,
    [
      squad.squad_name,
      squad.squad_avatar,
      squad.captain_id,
      squad.vice_captain_id,
      squad.intro,
      squad.category_id,
      squad.max_members,
      squad.member_count,
      squad.join_type,
      squad.status,
      squad.invite_code,
    ],
  );

  const squadId = result.insertId;

  // 队长作为首位成员写入
  if (captainId) {
    await pool.query(INSERT_SQUAD_MEMBER, [squadId, captainId, 0, '创建小队']);
  }
  if (viceCaptainId) {
    await pool.query(INSERT_SQUAD_MEMBER, [squadId, viceCaptainId, 2, '副队长']);
  }

  return {
    squad_id: squadId,
    ...squad,
    create_time: new Date().toISOString(),
    update_time: new Date().toISOString(),
  };
}

function resolveUserId(payload = {}, user = {}) {
  const userId = toPositiveInt(payload.user_id, toPositiveInt(user.sub, 0));
  return userId;
}

/**
 * 加入小队（支持新人入队与老成员重新入队）。
 * @param {number|string} squadId 小队 ID。
 * @param {Object} [payload] 提供 `user_id`（缺省回退 `user.sub`）作为目标用户 ID。
 * @param {Object} [user] 当前用户上下文。
 * @returns {Promise<Object>} 入队成功后的小队详情（getSquadDetail 结果）。
 * @throws {Error}
 *   - 400 —— squad_id 或 user_id 缺失；已在该队；小队人数已满；
 *   - 404 —— 小队不存在或已解散。
 * @description 入队流程：
 *   1. 校验小队存在；
 *   2. 若已是状态有效成员（member_status===1）直接报「已加入」；
 *   3. 执行带人数上限保护的 INC_SQUAD_MEMBER_COUNT（SQL 中限制 member_count < max_members），
 *      若 affectedRows 为 0 说明已达上限，抛「满员」错误——以此实现并发安全的满员控制；
 *   4. 已退队成员走 REJOIN 恢复，否则 INSERT 新成员（角色默认 1）；
 *   5. 返回最新小队详情。
 */
export async function joinSquad(squadId, payload = {}, user = {}) {
  const id = toPositiveInt(squadId, 0);
  const userId = resolveUserId(payload, user);
  if (!id || !userId) {
    const error = new Error('squad_id 与 user_id 均为必填');
    error.statusCode = 400;
    throw error;
  }

  const pool = getPool();
  const [squads] = await pool.query(GET_SQUAD_BY_ID, [id]);
  if (!squads.length) {
    const error = new Error(`小队不存在或已解散: ${id}`);
    error.statusCode = 404;
    throw error;
  }

  // 已加入则直接返回失败
  const [existing] = await pool.query(FIND_SQUAD_MEMBER, [id, userId]);
  if (existing.length && existing[0].member_status === 1) {
    const error = new Error('你已在该小队中');
    error.statusCode = 400;
    throw error;
  }

  // 先做带人数上限保护的计数自增，失败即满员
  const [incr] = await pool.query(INC_SQUAD_MEMBER_COUNT, [id]);
  if (!incr.affectedRows) {
    const error = new Error('小队人数已满');
    error.statusCode = 400;
    throw error;
  }

  if (existing.length) {
    await pool.query(REJOIN_SQUAD_MEMBER, [id, userId]);
  } else {
    await pool.query(INSERT_SQUAD_MEMBER, [id, userId, 1, '']);
  }

  return getSquadDetail(id);
}

/**
 * 退出小队。
 * @param {number|string} squadId 小队 ID。
 * @param {Object} [payload] 提供 `user_id`（缺省回退 `user.sub`）作为目标用户 ID。
 * @param {Object} [user] 当前用户上下文。
 * @returns {Promise<Object>} 退出成功后的小队详情（getSquadDetail 结果）。
 * @throws {Error}
 *   - 400 —— squad_id / user_id 缺失；用户不在队中；队长不可直接退出（须先转让）；
 *   - 404 —— 小队不存在或已解散。
 * @description 校验小队存在，确认用户为状态有效（member_status===1）的成员；
 * 队长（member_role===0）禁止退出，防止小队无主。通过 LEAVE_SQUAD_MEMBER
 * 将成员状态置为已退队，并 DEC_SQUAD_MEMBER_COUNT 回退人数计数，最后返回最新详情。
 */
export async function leaveSquad(squadId, payload = {}, user = {}) {
  const id = toPositiveInt(squadId, 0);
  const userId = resolveUserId(payload, user);
  if (!id || !userId) {
    const error = new Error('squad_id 与 user_id 均为必填');
    error.statusCode = 400;
    throw error;
  }

  const pool = getPool();
  const [squads] = await pool.query(GET_SQUAD_BY_ID, [id]);
  if (!squads.length) {
    const error = new Error(`小队不存在或已解散: ${id}`);
    error.statusCode = 404;
    throw error;
  }

  const [existing] = await pool.query(FIND_SQUAD_MEMBER, [id, userId]);
  const member = existing[0];
  if (!member || member.member_status !== 1) {
    const error = new Error('你不在该小队中');
    error.statusCode = 400;
    throw error;
  }
  if (member.member_role === 0) {
    const error = new Error('队长不可退出，请先转让队长');
    error.statusCode = 400;
    throw error;
  }

  await pool.query(LEAVE_SQUAD_MEMBER, [id, userId]);
  await pool.query(DEC_SQUAD_MEMBER_COUNT, [id]);

  return getSquadDetail(id);
}

/**
 * 批量统计多个小队各自的活动总数。
 * @param {Array<number|string>} [squadIds] 小队 ID 数组；对每个元素去重、转数字并过滤非正整数。
 * @returns {Promise<Object<string, number>>} 形如 `{ squad_id: 活动总数, ... }`；
 * 入参为空数组或过滤后无有效 ID 时返回空对象 {}。
 * @description 通过 `IN (...)` + `GROUP BY squad_id` 一次性统计所有目标小队的活动数量
 * （避免逐队查询的 N+1 问题），将结果映射为 squad_id → 数量的 Map。
 */
export async function countActivitiesBySquads(squadIds = []) {
  if (!Array.isArray(squadIds) || squadIds.length === 0) return {};
  const ids = [...new Set(squadIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (ids.length === 0) return {};

  const pool = getPool();
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT squad_id, COUNT(*) AS total FROM activities WHERE squad_id IN (${placeholders}) GROUP BY squad_id`,
    ids,
  );
  const result = {};
  for (const row of rows) result[row.squad_id] = row.total;
  return result;
}

/**
 * 查询当前用户已加入的所有小队。
 * @param {number|string} userId 用户 ID，经 toPositiveInt 校验为 0 则抛错。
 * @returns {Promise<Array<Object>>} 用户所在小队数组（经 mapSquad 归一化）。
 * @throws {Error} 400 —— userId 缺失（非正整数）。
 * @description 通过 LIST_MY_SQUADS（依据 user_id 关联成员表）查询用户所有在队记录，
 * 逐行映射为小队对象返回。
 */
export async function listMySquads(userId) {
  const id = toPositiveInt(userId, 0);
  if (!id) {
    const error = new Error('user_id 缺失');
    error.statusCode = 400;
    throw error;
  }

  const pool = getPool();
  const [rows] = await pool.query(LIST_MY_SQUADS, [id]);
  return rows.map(mapSquad);
}

/**
 * 转让小队队长。
 * @param {number|string} squadId 小队 ID。
 * @param {Object} [payload]
 *  - user_id / user.sub {number} 发起者（操作者）ID
 *  - target_user_id {number} 被转让的目标成员 ID
 * @param {Object} [user] 当前用户上下文，`user_id` 缺省时回退 `user.sub` 作为发起者。
 * @returns {Promise<Object>} 转让完成后的小队详情（getSquadDetail 结果）。
 * @throws {Error}
 *   - 400 —— squad_id / user_id / target_user_id 缺失；目标为队长本人；目标不在队中；
 *   - 404 —— 小队不存在或已解散；
 *   - 403 —— 发起者不是队长。
 * @description 权限与逻辑规则：
 *   1. 发起者须为该队状态有效（member_status===1）且为队长（member_role===0），否则 403；
 *   2. 目标须是队内有效成员且不能是发起者本人；
 *   3. 将目标 member_role 置 0（队长），发起者置 1（普通成员），并更新小队 captain_id；
 *   4. 返回最新小队详情。
 */
export async function transferCaptain(squadId, payload = {}, user = {}) {
  const id = toPositiveInt(squadId, 0);
  const callerId = toPositiveInt(payload.user_id, toPositiveInt(user.sub, 0));
  const targetId = toPositiveInt(payload.target_user_id, 0);
  if (!id || !callerId || !targetId) {
    const error = new Error('squad_id、user_id、target_user_id 均为必填');
    error.statusCode = 400;
    throw error;
  }

  const pool = getPool();
  const [squads] = await pool.query(GET_SQUAD_BY_ID, [id]);
  if (!squads.length) {
    const error = new Error(`小队不存在或已解散: ${id}`);
    error.statusCode = 404;
    throw error;
  }

  // 发起者必须是队长
  const [callerRows] = await pool.query(FIND_SQUAD_MEMBER, [id, callerId]);
  const caller = callerRows[0];
  if (!caller || caller.member_status !== 1 || caller.member_role !== 0) {
    const error = new Error('仅队长可转让队长');
    error.statusCode = 403;
    throw error;
  }

  // 目标必须是队内在队成员，且不是自己
  if (targetId === callerId) {
    const error = new Error('不能转让给队长本人');
    error.statusCode = 400;
    throw error;
  }
  const [targetRows] = await pool.query(FIND_SQUAD_MEMBER, [id, targetId]);
  const target = targetRows[0];
  if (!target || target.member_status !== 1) {
    const error = new Error('目标成员不在该小队中');
    error.statusCode = 400;
    throw error;
  }

  // 转让：目标设为队长，原队长降为普通成员
  await pool.query(SET_MEMBER_ROLE, [0, id, targetId]);
  await pool.query(SET_MEMBER_ROLE, [1, id, callerId]);
  await pool.query(UPDATE_SQUAD_CAPTAIN, [targetId, id]);

  return getSquadDetail(id);
}