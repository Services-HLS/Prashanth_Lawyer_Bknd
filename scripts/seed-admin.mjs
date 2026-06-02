/**
 * Create or update admin user from .env (ADMIN_USERNAME / ADMIN_PASSWORD).
 * Usage: npm run seed:admin
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { randomBytes } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const email = (process.env.ADMIN_USERNAME || "admin").includes("@")
  ? process.env.ADMIN_USERNAME.trim().toLowerCase()
  : `${(process.env.ADMIN_USERNAME || "admin").trim()}@admin.local`;
const password = process.env.ADMIN_PASSWORD || "changeme";
const name = process.env.ADMIN_DISPLAY_NAME || "Site Administrator";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  ssl: process.env.DB_HOST?.includes("rds.amazonaws.com") ? { rejectUnauthorized: false } : undefined,
});

const sql = await import("node:fs/promises").then((fs) =>
  fs.readFile(path.join(__dirname, "..", "database", "admin-auth.sql"), "utf8"),
);

for (const stmt of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
  await pool.query(stmt);
}

const hash = await bcrypt.hash(password, 12);
const id = randomBytes(8).toString("hex");

const [existing] = await pool.query(`SELECT id FROM admin_users WHERE email = ? LIMIT 1`, [email]);

if (existing.length) {
  await pool.query(`UPDATE admin_users SET password_hash = ?, full_name = ?, is_active = 1 WHERE email = ?`, [
    hash,
    name,
    email,
  ]);
  console.log(`Updated admin password for ${email}`);
} else {
  await pool.query(
    `INSERT INTO admin_users (id, email, password_hash, full_name, role, is_active)
     VALUES (?, ?, ?, ?, 'admin', 1)`,
    [id, email, hash, name],
  );
  console.log(`Created admin ${email}`);
}

console.log(`Sign in at /admin/login with email: ${email}`);
await pool.end();
