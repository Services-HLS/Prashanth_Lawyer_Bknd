import type { Pool, QueryValues, RowDataPacket } from "mysql2/promise";

import { getPool, resetPool } from "../db/pool.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransientDbError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = String((err as { code?: string }).code ?? "");
  const fatal = (err as { fatal?: boolean }).fatal === true;
  return (
    code === "ECONNRESET" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    (fatal && code === "ECONNRESET")
  );
}

export function isNetworkDbError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = String((err as { code?: string }).code ?? "");
  return code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "EHOSTUNREACH";
}

/** Run a pool query with reconnect + retry on transient RDS errors. */
export async function queryWithRetry<T>(
  run: (pool: Pool) => Promise<T>,
  retries = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await run(getPool());
    } catch (err) {
      lastErr = err;
      if (!isTransientDbError(err) || attempt >= retries - 1) {
        throw err;
      }
      resetPool();
      await sleep(300 * (attempt + 1));
    }
  }
  throw lastErr;
}

/** Convenience: SELECT query returning rows array. */
export async function queryRows<T extends RowDataPacket[]>(
  sql: string,
  params?: QueryValues,
): Promise<T> {
  return queryWithRetry(async (pool) => {
    const [rows] = await pool.query<T>(sql, params);
    return rows;
  });
}
