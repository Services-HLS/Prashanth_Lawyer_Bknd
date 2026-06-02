import { Router } from "express";

import { pingDatabase } from "../db/pool.js";
import { ok } from "../utils/http.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let database: "up" | "down" = "down";
  try {
    database = (await pingDatabase()) ? "up" : "down";
  } catch {
    database = "down";
  }

  ok(res, {
    status: database === "up" ? "ok" : "degraded",
    database,
    timestamp: new Date().toISOString(),
  });
});
