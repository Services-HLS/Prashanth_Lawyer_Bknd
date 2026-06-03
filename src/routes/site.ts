import type { RowDataPacket } from "mysql2/promise";
import { Router } from "express";

import { loadSitePayload } from "../services/siteContent.js";
import { getPool } from "../db/pool.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { queryWithRetry } from "../utils/dbRetry.js";
import { sanitizeArticleRow, sanitizeBookRow } from "../utils/articleContent.js";
import { stripHeavyImageFields } from "../utils/mediaFields.js";
import { cacheGet, cacheSet } from "../utils/responseCache.js";
import { fail, ok, parseJsonColumn } from "../utils/http.js";

const WRITING_CACHE_MS = 45_000;
const SITE_CACHE_MS = 60_000;

export const siteRouter = Router();

function setPublicCacheHeaders(res: import("express").Response, maxAgeSec = 30): void {
  res.setHeader("Cache-Control", `public, max-age=${maxAgeSec}, stale-while-revalidate=120`);
}

/** Published Work & Analysis section — articles + books from MySQL */
siteRouter.get("/writing", async (_req, res, next) => {
  try {
    const cached = cacheGet<{ articles: RowDataPacket[]; books: RowDataPacket[] }>("site:writing");
    if (cached) {
      setPublicCacheHeaders(res);
      ok(res, cached);
      return;
    }

    const [articles, books] = await Promise.all([
      queryWithRetry(async (pool) => {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT id, type, title, slug, description, category, tags,
                  featured_image, gallery_images, pdf_url, author, publish_date, status
           FROM articles WHERE status = 'published'
           ORDER BY publish_date DESC, created_at DESC`,
        );
        return rows.map((row) => {
          const base = stripHeavyImageFields(row as Record<string, unknown>);
          return sanitizeArticleRow(base, "list");
        });
      }),
      queryWithRetry(async (pool) => {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT id, type, title, slug, description, author, cover_image, buy_link, publication_date, publisher, isbn, status
           FROM books WHERE status = 'published'
           ORDER BY publication_date DESC, created_at DESC`,
        );
        return rows.map((row) => {
          const base = stripHeavyImageFields(row as Record<string, unknown>);
          return sanitizeBookRow(base, "list");
        });
      }),
    ]);

    const payload = { articles, books };
    cacheSet("site:writing", payload, WRITING_CACHE_MS);
    setPublicCacheHeaders(res);
    ok(res, payload);
  } catch (e) {
    next(e);
  }
});

/**
 * Single payload for the whole homepage (site.html sections).
 * Frontend can adopt later without changing section structure.
 */
siteRouter.get("/", async (_req, res, next) => {
  try {
    const cached = cacheGet<Awaited<ReturnType<typeof loadSitePayload>>>("site:payload");
    if (cached) {
      setPublicCacheHeaders(res, 60);
      ok(res, cached);
      return;
    }

    const data = await loadSitePayload();
    cacheSet("site:payload", data, SITE_CACHE_MS);
    setPublicCacheHeaders(res, 60);
    ok(res, data);
  } catch (e) {
    next(e);
  }
});

siteRouter.get("/settings/:key", async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT setting_key, setting_value FROM site_settings WHERE setting_key = :key LIMIT 1`,
      { key: req.params.key },
    );
    const row = (rows as { setting_key: string; setting_value: unknown }[])[0];
    if (!row) {
      fail(res, "Not found", 404);
      return;
    }
    ok(res, {
      key: row.setting_key,
      value: parseJsonColumn(row.setting_value, row.setting_value),
    });
  } catch (e) {
    next(e);
  }
});

const admin = Router();
admin.use(adminAuth);

admin.put("/settings/:key", async (req, res, next) => {
  try {
    const pool = getPool();
    const value = JSON.stringify(req.body.value ?? req.body);
    await pool.query(
      `INSERT INTO site_settings (setting_key, setting_value)
       VALUES (:key, :value)
       ON DUPLICATE KEY UPDATE setting_value = :value`,
      { key: req.params.key, value },
    );
    ok(res, { key: req.params.key });
  } catch (e) {
    next(e);
  }
});

siteRouter.use("/admin", admin);
