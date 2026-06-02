import type { Response } from "express";

export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ success: true, data });
}

export function fail(
  res: Response,
  message: string,
  status = 400,
  errors?: unknown,
): Response {
  return res.status(status).json({
    success: false,
    error: message,
    ...(errors !== undefined ? { errors } : {}),
  });
}

export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}
