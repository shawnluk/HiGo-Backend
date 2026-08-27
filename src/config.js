function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * 从环境变量中读取并生成应用配置对象。
 * 返回的字段含义如下：
 *
 * - `host`：服务监听地址，来自 `HOST`，缺省为 `0.0.0.0`。
 * - `port`：服务监听端口，来自 `PORT`（须为正数），缺省为 3000。
 * - `corsOrigin`：允许的跨域来源，来自 `CORS_ORIGIN`，缺省为 `*`。
 * - `jwtSecret`：JWT 签名密钥，来自 `JWT_SECRET`，缺省为 `unitone-dev-secret`。
 * - `dbHost`：数据库主机，来自 `DB_HOST`，缺省为 `localhost`。
 * - `dbPort`：数据库端口，来自 `DB_PORT`（须为正数），缺省为 3306。
 * - `dbUser`：数据库用户名，来自 `DB_USER`，缺省为 `root`。
 * - `dbPassword`：数据库密码，来自 `DB_PASSWORD`，缺省为空字符串。
 * - `dbName`：数据库名称，来自 `DB_NAME`，缺省为 `unitone`。
 *
 * @param {NodeJS.ProcessEnv} [env] 环境变量对象，缺省为 process.env。
 * @returns {object} 解析后的应用配置对象。
 */
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