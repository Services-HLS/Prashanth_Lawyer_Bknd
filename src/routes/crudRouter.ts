import { Router } from "express";

import type { TableConfig } from "../services/tableCrud.js";
import {
  deleteRow,
  getRowById,
  getRowBySlug,
  insertRow,
  listRows,
  updateRow,
} from "../services/tableCrud.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { sanitizeArticleRow, sanitizeBookRow } from "../utils/articleContent.js";
import { invalidatePublicContentCaches } from "../utils/responseCache.js";
import { fail, ok } from "../utils/http.js";
import { listRowsAdminSummary } from "../services/tableCrud.js";

type CrudRouterOptions = {
  config: TableConfig;
  slugRoute?: boolean;
  /** When false, skip GET / list (use a custom router instead) */
  publicList?: boolean;
};

export function createCrudRouter({
  config,
  slugRoute = true,
  publicList = true,
}: CrudRouterOptions): Router {
  const router = Router();
  const admin = Router();
  admin.use(adminAuth);

  admin.get("/", async (_req, res, next) => {
    try {
      const rows = await listRowsAdminSummary(config);
      ok(res, rows);
    } catch (e) {
      next(e);
    }
  });

  admin.get("/:id", async (req, res, next) => {
    try {
      const row = await getRowById(config, req.params.id);
      if (!row) {
        fail(res, "Not found", 404);
        return;
      }
      ok(res, row);
    } catch (e) {
      next(e);
    }
  });

  admin.post("/", async (req, res, next) => {
    try {
      const row = await insertRow(config, req.body);
      invalidatePublicContentCaches();
      ok(res, row, 201);
    } catch (e) {
      next(e);
    }
  });

  admin.put("/:id", async (req, res, next) => {
    try {
      const existing = await getRowById(config, req.params.id);
      if (!existing) {
        fail(res, "Not found", 404);
        return;
      }
      const row = await updateRow(config, req.params.id, req.body);
      invalidatePublicContentCaches();
      ok(res, row);
    } catch (e) {
      next(e);
    }
  });

  admin.delete("/:id", async (req, res, next) => {
    try {
      const removed = await deleteRow(config, req.params.id);
      if (!removed) {
        fail(res, "Not found", 404);
        return;
      }
      invalidatePublicContentCaches();
      ok(res, { id: req.params.id });
    } catch (e) {
      next(e);
    }
  });

  // Must be registered before /:idOrSlug or "admin" is treated as a slug
  router.use("/admin", admin);

  if (publicList) {
    router.get("/", async (_req, res, next) => {
      try {
        const rows = await listRows(config, { publishedOnly: true });
        ok(res, rows);
      } catch (e) {
        next(e);
      }
    });
  }

  router.get("/:idOrSlug", async (req, res, next) => {
    try {
      const param = req.params.idOrSlug;
      if (param === "admin") {
        fail(res, "Not found", 404);
        return;
      }

      let row: Awaited<ReturnType<typeof getRowById>> = null;

      if (slugRoute) {
        row = await getRowBySlug(config, param, { publishedOnly: true });
      }
      if (!row) {
        row = await getRowById(config, param, { publishedOnly: true });
      }
      if (!row) {
        fail(res, "Not found", 404);
        return;
      }
      let payload: Record<string, unknown> = row as Record<string, unknown>;
      if (config.table === "articles") payload = sanitizeArticleRow(payload, "detail");
      if (config.table === "books") payload = sanitizeBookRow(payload, "detail");
      ok(res, payload);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
