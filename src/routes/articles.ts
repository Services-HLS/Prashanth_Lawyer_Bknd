import type { RowDataPacket } from "mysql2/promise";
import { Router } from "express";

import { tableConfigs } from "../config/tables.js";
import { listRows } from "../services/tableCrud.js";
import { queryWithRetry } from "../utils/dbRetry.js";
import { sanitizeArticleRow } from "../utils/articleContent.js";
import { stripHeavyImageFields } from "../utils/mediaFields.js";
import { cacheGet, cacheSet } from "../utils/responseCache.js";
import { fail, ok } from "../utils/http.js";

const FEED_CACHE_MS = 45_000;

const config = tableConfigs.articles;

export const articlesRouter = Router();

/** @deprecated Use GET /api/v1/images/articles/:slug — kept for compatibility */
articlesRouter.get("/:slug/hero", async (req, res, next) => {
  try {
    const slug = req.params.slug;
    if (slug === "feed") {
      next();
      return;
    }
    const rows = await queryWithRetry(async (pool) => {
      const [result] = await pool.query<RowDataPacket[]>(
        `SELECT featured_image, gallery_images FROM articles
         WHERE slug = :slug AND status = 'published' LIMIT 1`,
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
      featured_image: rows[0].featured_image ?? null,
      gallery_images: rows[0].gallery_images ?? null,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Lightweight list for site.html "Published Work & Analysis" (no huge `content` body).
 */
articlesRouter.get("/feed", async (_req, res, next) => {
  try {
    const cached = cacheGet<RowDataPacket[]>("articles:feed");
    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
      ok(res, cached);
      return;
    }

    const rows = await queryWithRetry(async (pool) => {
      const [result] = await pool.query<RowDataPacket[]>(
        `SELECT id, type, title, slug, description, category, tags, featured_image, gallery_images, pdf_url, author, publish_date, status, created_at, updated_at
         FROM articles
         WHERE status = 'published'
         ORDER BY publish_date DESC, created_at DESC`,
      );
      return result.map((row) => {
        const base = stripHeavyImageFields(row as Record<string, unknown>);
        return sanitizeArticleRow(base, "list");
      });
    });
    cacheSet("articles:feed", rows, FEED_CACHE_MS);
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    ok(res, rows);
  } catch (e) {
    next(e);
  }
});

/** Matches site.html writing section — published articles */
articlesRouter.get("/", async (req, res, next) => {
  try {
    const category = req.query.category as string | undefined;
    const type = req.query.type as string | undefined;
    const where: string[] = [];
    const params: Record<string, unknown> = {};

    if (category) {
      where.push("category = :category");
      params.category = category;
    }
    if (type) {
      where.push("type = :type");
      params.type = type;
    }

    const listOptions = {
      publishedOnly: true,
      extraWhere: where.length ? where.join(" AND ") : undefined,
      params,
    };

    let rows = await listRows(config, listOptions);
    if (req.query.featured === "true") {
      rows = rows.filter((row) => row.is_featured === 1 || row.is_featured === true);
    }
    ok(res, rows);
  } catch (e) {
    next(e);
  }
});

/** Matches site.html #opinions — legal opinion cards */
articlesRouter.get("/opinions", async (_req, res, next) => {
  try {
    const rows = await listRows(config, {
      publishedOnly: true,
      extraWhere: "type = :type",
      params: { type: "legal_opinion" },
    });
    ok(res, rows);
  } catch (e) {
    next(e);
  }
});
