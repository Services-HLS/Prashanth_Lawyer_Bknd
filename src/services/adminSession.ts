import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "../config/env.js";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

export type SessionPayload = {
  u: string;
  id: string;
  exp: number;
};

function sessionSecret(): string {
  return env.sessionSecret;
}

function encodeBase64Url(data: string): string {
  return Buffer.from(data, "utf8").toString("base64url");
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createAdminSession(user: { id: string; email: string }): string {
  const payload: SessionPayload = {
    u: user.email,
    id: user.id,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const body = encodeBase64Url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyAdminSession(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  if (!body || !signature) return null;

  const expected = sign(body);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(decodeBase64Url(body)) as SessionPayload;
  } catch {
    return null;
  }

  if (!payload.u || typeof payload.exp !== "number" || payload.exp < Date.now()) {
    return null;
  }

  return payload;
}

export function safeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
