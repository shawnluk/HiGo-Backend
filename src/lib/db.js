import mysql from 'mysql2/promise';

let pool = null;

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

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}