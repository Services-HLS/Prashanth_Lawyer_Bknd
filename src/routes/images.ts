import type { RowDataPacket } from "mysql2/promise";
import { Router } from "express";

import { queryWithRetry } from "../utils/dbRetry.js";
import { fail, ok } from "../utils/http.js";

/**
 * Public image fields read directly from MySQL (articles.featured_image, books.cover_image, etc.)
 */
export const imagesRouter = Router();

imagesRouter.get("/articles/:slug", async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const rows = await queryWithRetry(async (pool) => {
      const [result] = await pool.query<RowDataPacket[]>(
        `SELECT id, slug, featured_image, gallery_images
         FROM articles
         WHERE slug = :slug AND status = 'published'
         LIMIT 1`,
        { slug },
      );
      return result;
    });

    if (!rows[0]) {
      fail(res, "Article not found", 404);
      return;
    }

    ok(res, {
      source: "mysql",
      table: "articles",
      id: rows[0].id,
      slug: rows[0].slug,
      featured_image: rows[0].featured_image ?? null,
      gallery_images: rows[0].gallery_images ?? null,
    });
  } catch (e) {
    next(e);
  }
});

imagesRouter.get("/books/:slug", async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const rows = await queryWithRetry(async (pool) => {
      const [result] = await pool.query<RowDataPacket[]>(
        `SELECT id, slug, cover_image
         FROM books
         WHERE slug = :slug AND status = 'published'
         LIMIT 1`,
        { slug },
      );
      return result;
    });

    if (!rows[0]) {
      fail(res, "Book not found", 404);
      return;
    }

    ok(res, {
      source: "mysql",
      table: "books",
      id: rows[0].id,
      slug: rows[0].slug,
      cover_image: rows[0].cover_image ?? null,
    });
  } catch (e) {
    next(e);
  }
});
