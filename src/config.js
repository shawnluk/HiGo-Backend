function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getConfig(env = process.env) {
  return {
    host: env.HOST || '0.0.0.0',
    port: numberFromEnv(env.PORT, 3000),
    corsOrigin: env.CORS_ORIGIN || '*',
    jwtSecret: env.JWT_SECRET || 'unitone-dev-secret',
  };
}

module.exports = { getConfig };
