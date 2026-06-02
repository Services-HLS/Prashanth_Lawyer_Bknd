import type { RowDataPacket } from "mysql2/promise";
import { Router } from "express";

import { loadSitePayload } from "../services/siteContent.js";
import { getPool } from "../db/pool.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { queryWithRetry } from "../utils/dbRetry.js";
import { sanitizeArticleRow, sanitizeBookRow } from "../utils/articleContent.js";
import { fail, ok, parseJsonColumn } from "../utils/http.js";

export const siteRouter = Router();

/** Published Work & Analysis section — articles + books from MySQL */
siteRouter.get("/writing", async (_req, res, next) => {
  try {
    const articles = await queryWithRetry(async (pool) => {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, type, title, slug, description, category, tags,
                featured_image, gallery_images, pdf_url, author, publish_date, status,
                SUBSTRING(content, 1, 4000) AS content
         FROM articles WHERE status = 'published'
         ORDER BY publish_date DESC, created_at DESC`,
      );
      return rows.map((row) => {
        const img = row.featured_image as string | null | undefined;
        let base: Record<string, unknown> = { ...row };
        if (typeof img === "string" && img.length > 80_000) {
          base = { ...base, featured_image: null, has_featured_image: 1 };
        }
        const sanitized = sanitizeArticleRow(base);
        const { content: _content, ...publicRow } = sanitized;
        return publicRow;
      });
    });

    const books = await queryWithRetry(async (pool) => {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, type, title, slug, description, author, cover_image, buy_link, publication_date, publisher, isbn, status
         FROM books WHERE status = 'published'
         ORDER BY publication_date DESC, created_at DESC`,
      );
      return rows.map((row) => {
        const cover = row.cover_image as string | null | undefined;
        let base: Record<string, unknown> = { ...row };
        if (typeof cover === "string" && cover.length > 80_000) {
          base = { ...base, cover_image: null, has_cover_image: 1 };
        }
        return sanitizeBookRow(base);
      });
    });

    ok(res, { articles, books });
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
    const data = await loadSitePayload();
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
