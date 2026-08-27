import crypto from 'node:crypto';

const TOKEN_EXPIRY_SECONDS = 60 * 60 * 24; // 5 分钟

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/**
 * 使用 HS256 算法签发 JWT。
 * 将头部（alg/typ）与载荷 payload 分别做 base64url 编码，取其拼接结果经 HMAC-SHA256
 * 签名并 base64url 编码，最终拼成 `header.body.signature` 三段式令牌。
 * @param {object} payload 载荷对象
 * @param {string} secret 签名密钥
 * @returns {string} 生成的 JWT 字符串
 */
export function signToken(payload, secret) {
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const body = base64url(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * 校验 JWT 并返回载荷。
 * 依次校验：令牌缺失、分段不完整（格式错误）、密码学签名不匹配均以状态码 401 抛出错误；
 * 签名通过后解码 body 还原载荷，若携带 exp 且已过期（小于当前 Unix 时间戳）同样以 401 拒绝。
 * @param {string} token JWT 字符串
 * @param {string} secret 签名密钥
 * @returns {object} 解码后的载荷对象
 * @throws {Error} 校验失败时抛出携带 statusCode=401 的错误
 */
export function verifyToken(token, secret) {
  if (!token) {
    const error = new Error('Token is required');
    error.statusCode = 401;
    throw error;
  }

  const [headerB64, bodyB64, signatureB64] = token.split('.');
  if (!headerB64 || !bodyB64 || !signatureB64) {
    const error = new Error('Invalid token format');
    error.statusCode = 401;
    throw error;
  }

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${bodyB64}`)
    .digest('base64url');

  if (expectedSig !== signatureB64) {
    const error = new Error('Invalid token signature');
    error.statusCode = 401;
    throw error;
  }

  const payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8'));

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    const error = new Error('Token has expired');
    error.statusCode = 401;
    throw error;
  }

  return payload;
}

/**
 * 构造 JWT 载荷对象。
 * 载荷包含 sub（主体，转成字符串）、iat（签发时间，Unix 秒）、
 * exp（过期时间，签发时间加 TOKEN_EXPIRY_SECONDS）以及扩展的自定义字段 extra。
 * @param {string|number} sub 令牌主体标识
 * @param {object} [extra={}] 额外自定义载荷字段
 * @returns {object} JWT 载荷对象
 */
export function makeTokenPayload(sub, extra = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: String(sub),
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
    ...extra,
  };
}