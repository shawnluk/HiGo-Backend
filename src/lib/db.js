import mysql from 'mysql2/promise';

let pool = null;

/**
 * 初始化数据库连接池。
 * 根据配置创建 MySQL 连接池并缓存到模块级变量 pool 中；若已初始化则直接返回已有实例，避免重复创建。
 * @param {{dbHost:string,dbPort:number,dbUser:string,dbPassword:string,dbName:string}} config 数据库连接配置
 * @returns {import('mysql2/promise').Pool} 连接池实例
 */
export function initPool(config) {
  if (pool) return pool;
  pool = mysql.createPool({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
  });
  return pool;
}

export function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initPool(config) first.');
  }
  return pool;
}

/**
 * 关闭数据库连接池并释放资源。
 * 调用 pool.end() 关闭所有连接，随后将 pool 置空以便后续可重新初始化。
 * @returns {Promise<void>}
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}