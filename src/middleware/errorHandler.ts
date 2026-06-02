import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { env } from "../config/env.js";
import { isNetworkDbError, isTransientDbError } from "../utils/dbRetry.js";
import { fail } from "../utils/http.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    fail(res, "Validation failed", 400, err.flatten());
    return;
  }

  if (err && typeof err === "object" && "code" in err) {
    const code = String((err as { code: string }).code);
    const hostname =
      err instanceof Error && "hostname" in err
        ? String((err as Error & { hostname?: string }).hostname ?? "")
        : env.mysql.host;

    if (isTransientDbError(err)) {
      console.warn("[db] transient connection error:", code);
      fail(
        res,
        env.isDev
          ? `Database connection lost (${code}). Wait a moment and refresh — RDS may have closed the connection.`
          : "Database temporarily unavailable. Please try again.",
        503,
      );
      return;
    }

    if (isNetworkDbError(err)) {
      console.warn("[db] cannot reach host:", hostname, code);
      fail(
        res,
        env.isDev
          ? `Cannot reach database host "${hostname}" (${code}). Check internet/VPN and DB_HOST in backend/.env.`
          : "Database unavailable. Check your network connection.",
        503,
      );
      return;
    }

    if (code === "ER_ACCESS_DENIED_ERROR") {
      fail(
        res,
        env.isDev
          ? "Database login failed — check DB_HOST, DB_USER, and DB_PASSWORD in backend/.env, then restart"
          : "Database connection failed",
        500,
      );
      return;
    }

    if (code === "ER_NO_SUCH_TABLE") {
      const sqlMsg = err instanceof Error ? err.message : "missing table";
      fail(
        res,
        env.isDev
          ? `${sqlMsg} — run backend/database/base-schema.sql and schema-extensions.sql on your database`
          : "Database schema not ready",
        500,
      );
      return;
    }
  }

  console.error(err);

  const message =
    env.isDev && err instanceof Error ? err.message : "Internal server error";
  fail(res, message, 500);
}
