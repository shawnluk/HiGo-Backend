import crypto from 'node:crypto';

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signToken(payload, secret) {
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const body = base64url(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function login(credentials, config) {
  const username = String(credentials.username || '').trim();
  const password = String(credentials.password || '').trim();

  if (!username || !password) {
    const error = new Error('Username and password are required');
    error.statusCode = 400;
    throw error;
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signToken(
    {
      sub: username,
      displayName: username,
      iat: now,
      exp: now + 60 * 60 * 24 * 7,
    },
    config.jwtSecret,
  );

  return {
    token,
    displayName: username,
  };
}