import { Router } from "express";
import { z } from "zod";

import { tableConfigs } from "../config/tables.js";
import { adminAuth } from "../middleware/adminAuth.js";
import {
  deleteRow,
  getRowById,
  getRowBySlug,
  insertRow,
  listRows,
  updateRow,
} from "../services/tableCrud.js";
import { apiToRow, contentTypeToConfigKey, rowToApi } from "../utils/caseTransform.js";
import { fail, ok } from "../utils/http.js";
import { newId } from "../utils/id.js";

const typeSchema = z.enum(["article", "topic", "book", "podcast", "about"]);

export const contentRouter = Router();

function getConfig(type: string) {
  const key = contentTypeToConfigKey[type];
  if (!key) return null;
  return tableConfigs[key];
}

function serializeBodyForDb(body: Record<string, unknown>): Record<string, unknown> {
  const row = apiToRow(body);
  if (row.gallery_images && Array.isArray(row.gallery_images)) {
    row.gallery_images = JSON.stringify(row.gallery_images);
  }
  if (row.platform_links && typeof row.platform_links === "object") {
    row.platform_links = JSON.stringify(row.platform_links);
  }
  if (row.tags && Array.isArray(row.tags)) {
    row.tags = row.tags.join(",");
  }
  if (row.topic_ids && Array.isArray(row.topic_ids)) {
    row.topic_ids = JSON.stringify(row.topic_ids);
  }
  return row;
}

/** LexResolve-compatible: GET /api/content?action=list&type=article */
contentRouter.get("/", async (req, res, next) => {
  try {
    const type = String(req.query.type ?? "");
    const parsed = typeSchema.safeParse(type);
    if (!parsed.success) {
      fail(res, "Invalid or missing type", 400);
      return;
    }

    const config = getConfig(parsed.data);
    if (!config) {
      fail(res, "Invalid type", 400);
      return;
    }

    const action = String(req.query.action ?? "list");
    const statusParam = String(req.query.status ?? "published");

    if (action === "single") {
      const id = req.query.id as string | undefined;
      const slug = req.query.slug as string | undefined;
      if (!id && !slug) {
        fail(res, "id or slug required for single", 400);
        return;
      }

      let row = null;
      if (slug) {
        row = await getRowBySlug(config, slug, {
          publishedOnly: statusParam !== "all",
        });
      }
      if (!row && id) {
        row = await getRowById(config, id, {
          publishedOnly: statusParam !== "all",
        });
      }
      if (!row) {
        fail(res, "Content not found", 404);
        return;
      }
      ok(res, rowToApi(row as Record<string, unknown>));
      return;
    }

    const publishedOnly = statusParam !== "all";
    const rows = await listRows(config, { publishedOnly });
    ok(res, rows.map((r) => rowToApi(r as Record<string, unknown>)));
  } catch (e) {
    next(e);
  }
});

contentRouter.use(adminAuth);

/** POST /api/content — create */
contentRouter.post("/", async (req, res, next) => {
  try {
    const type = String(req.body.type ?? "");
    const parsed = typeSchema.safeParse(type);
    if (!parsed.success) {
      fail(res, "Invalid or missing type", 400);
      return;
    }

    const config = getConfig(parsed.data);
    if (!config) {
      fail(res, "Invalid type", 400);
      return;
    }

    const body = serializeBodyForDb({ ...req.body });
    const id = (body.id as string) || newId();
    const row = await insertRow(config, body, id);
    if (!row) {
      fail(res, "Create failed", 500);
      return;
    }
    res.status(201).json({ success: true, data: rowToApi(row as Record<string, unknown>) });
  } catch (e) {
    next(e);
  }
});

/** PUT /api/content/:type/:id */
contentRouter.put("/:type/:id", async (req, res, next) => {
  try {
    const parsed = typeSchema.safeParse(req.params.type);
    if (!parsed.success) {
      fail(res, "Invalid type", 400);
      return;
    }

    const config = getConfig(parsed.data);
    if (!config) {
      fail(res, "Invalid type", 400);
      return;
    }

    const existing = await getRowById(config, req.params.id);
    if (!existing) {
      fail(res, "Content not found", 404);
      return;
    }

    const body = serializeBodyForDb({ ...req.body });
    const row = await updateRow(config, req.params.id, body);
    if (!row) {
      fail(res, "Update failed", 500);
      return;
    }
    ok(res, rowToApi(row as Record<string, unknown>));
  } catch (e) {
    next(e);
  }
});

/** DELETE /api/content/:type/:id */
contentRouter.delete("/:type/:id", async (req, res, next) => {
  try {
    const parsed = typeSchema.safeParse(req.params.type);
    if (!parsed.success) {
      fail(res, "Invalid type", 400);
      return;
    }

    const config = getConfig(parsed.data);
    if (!config) {
      fail(res, "Invalid type", 400);
      return;
    }

    const removed = await deleteRow(config, req.params.id);
    if (!removed) {
      fail(res, "Content not found", 404);
      return;
    }
    ok(res, { success: true });
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/content/:type/:id/status */
contentRouter.patch("/:type/:id/status", async (req, res, next) => {
  try {
    const parsed = typeSchema.safeParse(req.params.type);
    if (!parsed.success) {
      fail(res, "Invalid type", 400);
      return;
    }

    const status = req.body.status;
    if (status !== "draft" && status !== "published") {
      fail(res, "status must be draft or published", 400);
      return;
    }

    const config = getConfig(parsed.data);
    if (!config) {
      fail(res, "Invalid type", 400);
      return;
    }

    const row = await updateRow(config, req.params.id, { status });
    if (!row) {
      fail(res, "Content not found", 404);
      return;
    }
    ok(res, { success: true, data: rowToApi(row as Record<string, unknown>) });
  } catch (e) {
    next(e);
  }
});
