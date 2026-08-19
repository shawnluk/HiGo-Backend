function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getConfig(env = process.env) {
  // console.log(env);
  
  return {
    host: env.HOST || '0.0.0.0',
    port: numberFromEnv(env.PORT, 3000),
    corsOrigin: env.CORS_ORIGIN || '*',
    jwtSecret: env.JWT_SECRET || 'unitone-dev-secret',
    dbHost: env.DB_HOST || 'localhost',
    dbPort: numberFromEnv(env.DB_PORT, 3306),
    dbUser: env.DB_USER || 'root',
    dbPassword: env.DB_PASSWORD || '',
    dbName: env.DB_NAME || 'unitone',
  };
}