import type { NextFunction, Request, Response } from "express";

import { env, requireAdminKey } from "../config/env.js";
import { verifyAdminSession } from "../services/adminSession.js";
import { fail } from "../utils/http.js";

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const bearer = req.header("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) {
    const session = verifyAdminSession(bearer);
    if (session) {
      req.adminUser = session.u;
      req.adminUserId = session.id;
      next();
      return;
    }
  }

  if (env.adminApiKey) {
    const headerKey =
      req.header("X-Admin-Key") ?? req.header("Authorization")?.replace(/^Bearer\s+/i, "");
    try {
      const expected = requireAdminKey();
      if (headerKey && headerKey === expected) {
        next();
        return;
      }
    } catch {
      fail(res, "Admin API is not configured", 503);
      return;
    }
  }

  fail(res, "Unauthorized", 401);
}
