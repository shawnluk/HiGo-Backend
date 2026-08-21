import crypto from 'node:crypto';

const TOKEN_EXPIRY_SECONDS = 60 * 5; // 5 分钟

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function signToken(payload, secret) {
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const body = base64url(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

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

export function makeTokenPayload(sub, extra = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: String(sub),
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
    ...extra,
  };
}