import mysql from "mysql2/promise";

import { env } from "../config/env.js";

let pool: mysql.Pool | undefined;

export function resetPool(): void {
  if (pool) {
    void pool.end().catch(() => undefined);
    pool = undefined;
  }
}

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: env.mysql.host,
      port: env.mysql.port,
      user: env.mysql.user,
      password: env.mysql.password,
      database: env.mysql.database,
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 20_000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
      namedPlaceholders: true,
      dateStrings: true,
      ...(env.mysql.ssl
        ? {
            ssl: {
              rejectUnauthorized: env.mysql.sslRejectUnauthorized,
            },
          }
        : {}),
    });
  }
  return pool;
}

export async function pingDatabase(): Promise<boolean> {
  const { queryWithRetry } = await import("../utils/dbRetry.js");
  await queryWithRetry(async (pool) => {
    const connection = await pool.getConnection();
    try {
      await connection.ping();
    } finally {
      connection.release();
    }
  });
  return true;
}
