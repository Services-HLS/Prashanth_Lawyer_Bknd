import { createHash, randomBytes } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import bcrypt from "bcryptjs";

import { getPool } from "../db/pool.js";
import { env } from "../config/env.js";
import { newId } from "../utils/id.js";
import { queryWithRetry } from "../utils/dbRetry.js";

const BCRYPT_ROUNDS = 12;
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export type AdminUserRow = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  role: "admin" | "editor";
  is_active: number;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function findAdminByLogin(login: string): Promise<AdminUserRow | null> {
  const value = login.trim();
  const email = normalizeEmail(value.includes("@") ? value : `${value}@admin.local`);

  const rows = await queryWithRetry(async (pool) => {
    const [result] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, password_hash, full_name, role, is_active
       FROM admin_users
       WHERE is_active = 1 AND (email = :email OR email = :raw OR id = :raw)
       LIMIT 1`,
      { email, raw: value },
    );
    return result;
  });

  const row = rows[0];
  if (!row) return null;
  return row as unknown as AdminUserRow;
}

export async function findAdminById(id: string): Promise<AdminUserRow | null> {
  const rows = await queryWithRetry(async (pool) => {
    const [result] = await pool.query<RowDataPacket[]>(
      `SELECT id, email, password_hash, full_name, role, is_active
       FROM admin_users WHERE id = :id AND is_active = 1 LIMIT 1`,
      { id },
    );
    return result;
  });
  const row = rows[0];
  if (!row) return null;
  return row as unknown as AdminUserRow;
}

export async function touchLastLogin(userId: string): Promise<void> {
  const pool = getPool();
  await pool.query(`UPDATE admin_users SET last_login_at = NOW() WHERE id = :id`, { id: userId });
}

export async function updateAdminPassword(userId: string, newPlainPassword: string): Promise<void> {
  const password_hash = await hashPassword(newPlainPassword);
  const pool = getPool();
  await pool.query(`UPDATE admin_users SET password_hash = :hash WHERE id = :id`, {
    hash: password_hash,
    id: userId,
  });
}

export async function createPasswordReset(email: string): Promise<{
  token: string;
  expiresAt: Date;
} | null> {
  const user = await findAdminByLogin(email);
  if (!user) return null;

  const token = randomBytes(32).toString("hex");
  const token_hash = hashResetToken(token);
  const id = newId();
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  const pool = getPool();
  await pool.query(
    `UPDATE admin_password_resets SET used_at = NOW()
     WHERE user_id = :userId AND used_at IS NULL`,
    { userId: user.id },
  );

  await pool.query(
    `INSERT INTO admin_password_resets (id, user_id, token_hash, expires_at)
     VALUES (:id, :userId, :tokenHash, :expiresAt)`,
    {
      id,
      userId: user.id,
      tokenHash: token_hash,
      expiresAt,
    },
  );

  return { token, expiresAt };
}

export async function resetPasswordWithToken(
  token: string,
  newPlainPassword: string,
): Promise<boolean> {
  const token_hash = hashResetToken(token.trim());
  const pool = getPool();

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.id AS reset_id, r.user_id, r.expires_at, r.used_at
     FROM admin_password_resets r
     WHERE r.token_hash = :tokenHash
     LIMIT 1`,
    { tokenHash: token_hash },
  );

  const row = rows[0];
  if (!row || row.used_at) return false;

  const expiresAt = new Date(row.expires_at as string);
  if (expiresAt.getTime() < Date.now()) return false;

  const userId = String(row.user_id);
  await updateAdminPassword(userId, newPlainPassword);

  await pool.query(`UPDATE admin_password_resets SET used_at = NOW() WHERE id = :id`, {
    id: row.reset_id,
  });

  return true;
}

export async function countAdminUsers(): Promise<number> {
  const rows = await queryWithRetry(async (pool) => {
    const [result] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM admin_users`,
    );
    return result;
  });
  return Number(rows[0]?.c ?? 0);
}

/** Create first admin from .env when table is empty (one-time bootstrap). */
export async function ensureDefaultAdminFromEnv(): Promise<void> {
  try {
    const count = await countAdminUsers();
    if (count > 0) return;

    const username = env.adminUsername.trim();
    const password = env.adminPassword;
    if (!username || !password) {
      console.warn(
        "[admin] No admin_users rows and ADMIN_USERNAME/ADMIN_PASSWORD unset — run database/admin-auth.sql and npm run seed:admin",
      );
      return;
    }

    const email = username.includes("@") ? normalizeEmail(username) : normalizeEmail(`${username}@admin.local`);
    const password_hash = await hashPassword(password);
    const id = newId();
    const pool = getPool();

    await pool.query(
      `INSERT INTO admin_users (id, email, password_hash, full_name, role, is_active)
       VALUES (:id, :email, :hash, :name, 'admin', 1)`,
      {
        id,
        email,
        hash: password_hash,
        name: env.adminDisplayName || "Site Administrator",
      },
    );

    console.info(`[admin] Created default admin user: ${email}`);
  } catch (err) {
    console.warn("[admin] Could not bootstrap admin_users:", (err as Error).message);
  }
}
