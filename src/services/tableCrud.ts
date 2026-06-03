import type { QueryValues, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { queryRows, queryWithRetry } from "../utils/dbRetry.js";
import { newId } from "../utils/id.js";

export type TableConfig = {
  table: string;
  /** Columns allowed on create/update (excludes id, timestamps if auto) */
  columns: string[];
  /** Public list filter e.g. status = published */
  publicWhere?: string;
  orderBy?: string;
};

function pickBody(body: Record<string, unknown>, columns: string[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const col of columns) {
    if (body[col] !== undefined) {
      row[col] = body[col];
    }
  }
  return row;
}

function serializeValue(value: unknown): unknown {
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  return value;
}

function isUnknownColumnError(err: unknown): boolean {
  return (
    err instanceof Error &&
    "code" in err &&
    (err as { code?: string }).code === "ER_BAD_FIELD_ERROR"
  );
}

export function isNoSuchTableError(err: unknown): boolean {
  return (
    err instanceof Error &&
    "code" in err &&
    (err as { code?: string }).code === "ER_NO_SUCH_TABLE"
  );
}

/** List rows; returns [] if the table has not been created yet. */
export async function safeListRows(
  config: TableConfig,
  options: Parameters<typeof listRows>[1] = {},
): Promise<RowDataPacket[]> {
  try {
    return await listRows(config, options);
  } catch (err) {
    if (isNoSuchTableError(err)) {
      return [];
    }
    throw err;
  }
}

export async function listRows(
  config: TableConfig,
  options: { publishedOnly?: boolean; extraWhere?: string; params?: Record<string, unknown> } = {},
): Promise<RowDataPacket[]> {
  const orderBy = config.orderBy ?? "created_at DESC";

  const run = async (order: string) => {
    const parts: string[] = [`SELECT * FROM \`${config.table}\``];
    const params: Record<string, unknown> = { ...options.params };

    const where: string[] = [];
    if (options.publishedOnly && config.publicWhere) {
      where.push(config.publicWhere);
    }
    if (options.extraWhere) {
      where.push(options.extraWhere);
    }
    if (where.length) {
      parts.push(`WHERE ${where.join(" AND ")}`);
    }

    parts.push(`ORDER BY ${order}`);

    return queryRows<RowDataPacket[]>(parts.join(" "), params as QueryValues);
  };

  try {
    return await run(orderBy);
  } catch (err) {
    if (isUnknownColumnError(err) && orderBy !== "created_at DESC") {
      return await run("created_at DESC");
    }
    throw err;
  }
}

/** Admin CMS list — skips huge content/images so publish screens load fast */
export async function listRowsAdminSummary(config: TableConfig): Promise<RowDataPacket[]> {
  const orderBy = config.orderBy ?? "created_at DESC";

  if (config.table === "articles") {
    return queryRows<RowDataPacket[]>(
      `SELECT id, type, title, slug, status, category, tags, author, publish_date, created_at, updated_at,
              pdf_url,
              LEFT(description, 320) AS description,
              CASE WHEN featured_image IS NOT NULL AND LENGTH(featured_image) > 0 THEN 1 ELSE 0 END AS has_featured_image,
              CASE WHEN content IS NOT NULL AND LENGTH(content) > 0 THEN 1 ELSE 0 END AS has_content
       FROM \`articles\`
       ORDER BY ${orderBy}`,
    );
  }

  if (config.table === "books") {
    return queryRows<RowDataPacket[]>(
      `SELECT id, type, title, slug, status, author, publisher, isbn, buy_link, publication_date, created_at, updated_at,
              LEFT(description, 320) AS description,
              CASE WHEN cover_image IS NOT NULL AND LENGTH(cover_image) > 0 THEN 1 ELSE 0 END AS has_cover_image
       FROM \`books\`
       ORDER BY ${orderBy}`,
    );
  }

  if (config.table === "podcasts") {
    return queryRows<RowDataPacket[]>(
      `SELECT id, type, title, slug, status, summary, guest_name, duration, episode_number, audio_url, video_url, created_at, updated_at,
              LEFT(description, 320) AS description,
              CASE WHEN cover_image IS NOT NULL AND LENGTH(cover_image) > 0 THEN 1 ELSE 0 END AS has_cover_image
       FROM \`podcasts\`
       ORDER BY ${orderBy}`,
    );
  }

  return listRows(config, { publishedOnly: false });
}

export async function getRowById(
  config: TableConfig,
  id: string,
  options: { publishedOnly?: boolean } = {},
): Promise<RowDataPacket | null> {
  const where: string[] = ["id = :id"];
  const params: Record<string, unknown> = { id };

  if (options.publishedOnly && config.publicWhere) {
    where.push(config.publicWhere);
  }

  const rows = await queryRows<RowDataPacket[]>(
    `SELECT * FROM \`${config.table}\` WHERE ${where.join(" AND ")} LIMIT 1`,
    params as QueryValues,
  );
  return rows[0] ?? null;
}

export async function getRowBySlug(
  config: TableConfig,
  slug: string,
  options: { publishedOnly?: boolean } = {},
): Promise<RowDataPacket | null> {
  const where: string[] = ["slug = :slug"];
  const params: Record<string, unknown> = { slug };

  if (options.publishedOnly && config.publicWhere) {
    where.push(config.publicWhere);
  }

  const rows = await queryRows<RowDataPacket[]>(
    `SELECT * FROM \`${config.table}\` WHERE ${where.join(" AND ")} LIMIT 1`,
    params as QueryValues,
  );
  return rows[0] ?? null;
}

export async function insertRow(
  config: TableConfig,
  body: Record<string, unknown>,
  id = newId(),
): Promise<RowDataPacket | null> {
  const row = pickBody(body, config.columns);
  row.id = id;

  const keys = Object.keys(row);
  const placeholders = keys.map((k) => `:${k}`).join(", ");
  const cols = keys.map((k) => `\`${k}\``).join(", ");
  const params: Record<string, unknown> = {};
  for (const k of keys) {
    params[k] = serializeValue(row[k]);
  }

  await queryWithRetry(async (pool) => {
    await pool.query<ResultSetHeader>(
      `INSERT INTO \`${config.table}\` (${cols}) VALUES (${placeholders})`,
      params as QueryValues,
    );
  });

  return getRowById(config, id);
}

export async function updateRow(
  config: TableConfig,
  id: string,
  body: Record<string, unknown>,
): Promise<RowDataPacket | null> {
  const row = pickBody(body, config.columns);
  const keys = Object.keys(row);
  if (!keys.length) {
    return getRowById(config, id);
  }

  const sets = keys.map((k) => `\`${k}\` = :${k}`).join(", ");
  const params: Record<string, unknown> = { id };
  for (const k of keys) {
    params[k] = serializeValue(row[k]);
  }

  await queryWithRetry(async (pool) => {
    await pool.query<ResultSetHeader>(
      `UPDATE \`${config.table}\` SET ${sets} WHERE id = :id`,
      params as QueryValues,
    );
  });

  return getRowById(config, id);
}

export async function deleteRow(config: TableConfig, id: string): Promise<boolean> {
  const result = await queryWithRetry(async (pool) => {
    const [header] = await pool.query<ResultSetHeader>(
      `DELETE FROM \`${config.table}\` WHERE id = :id`,
      { id },
    );
    return header;
  });
  return result.affectedRows > 0;
}
