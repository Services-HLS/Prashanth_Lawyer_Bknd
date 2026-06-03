import type { RowDataPacket } from "mysql2/promise";
import { Router } from "express";

import { queryWithRetry } from "../utils/dbRetry.js";
import { sanitizeBookRow } from "../utils/bookContent.js";
import { stripHeavyImageFields } from "../utils/mediaFields.js";
import { cacheGet, cacheSet } from "../utils/responseCache.js";
import { fail, ok } from "../utils/http.js";

const FEED_CACHE_MS = 45_000;

export const booksRouter = Router();

/** Cover image from MySQL books.cover_image (for list cards when omitted from bulk payload) */
booksRouter.get("/:slug/cover", async (req, res, next) => {
  try {
    const slug = req.params.slug;
    if (slug === "feed") {
      next();
      return;
    }
    const rows = await queryWithRetry(async (pool) => {
      const [result] = await pool.query<RowDataPacket[]>(
        `SELECT cover_image FROM books WHERE slug = :slug AND status = 'published' LIMIT 1`,
        { slug },
      );
      return result;
    });
    if (!rows[0]) {
      fail(res, "Not found", 404);
      return;
    }
    ok(res, {
      source: "mysql",
      cover_image: rows[0].cover_image ?? null,
    });
  } catch (e) {
    next(e);
  }
});

/** Lightweight list for site.html Published Work section */
booksRouter.get("/feed", async (_req, res, next) => {
  try {
    const cached = cacheGet<RowDataPacket[]>("books:feed");
    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
      ok(res, cached);
      return;
    }

    const rows = await queryWithRetry(async (pool) => {
      const [result] = await pool.query<RowDataPacket[]>(
        `SELECT id, type, title, slug, description, author, cover_image, buy_link, publication_date, publisher, isbn, status, created_at, updated_at
         FROM books
         WHERE status = 'published'
         ORDER BY publication_date DESC, created_at DESC`,
      );
      return result.map((row) => {
        const base = stripHeavyImageFields(row as Record<string, unknown>);
        return sanitizeBookRow(base, "list");
      });
    });
    cacheSet("books:feed", rows, FEED_CACHE_MS);
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    ok(res, rows);
  } catch (e) {
    next(e);
  }
});
