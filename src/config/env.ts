import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(backendRoot, ".env") });
// Fallback when cwd differs (e.g. started from repo root)
dotenv.config({ path: path.join(process.cwd(), ".env") });
dotenv.config({ path: path.join(process.cwd(), "backend", ".env") });

function pick(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

function optional(keys: string | string[], fallback: string): string {
  const names = Array.isArray(keys) ? keys : [keys];
  return pick(...names) ?? fallback;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number(optional("PORT", "3001")),
  isDev: optional("NODE_ENV", "development") !== "production",

  mysql: {
    host: optional(["DB_HOST", "MYSQL_HOST"], "127.0.0.1"),
    port: Number(optional(["DB_PORT", "MYSQL_PORT"], "3306")),
    user: optional(["DB_USER", "MYSQL_USER"], "root"),
    password: pick("DB_PASSWORD", "MYSQL_PASSWORD") ?? "",
    database: optional(["DB_NAME", "MYSQL_DATABASE"], "prasanth_lawyer"),
    ssl:
      pick("DB_SSL") === "true" ||
      optional(["DB_HOST", "MYSQL_HOST"], "").includes("rds.amazonaws.com"),
    sslRejectUnauthorized: pick("DB_SSL_REJECT_UNAUTHORIZED") === "true",
  },

  corsOrigin: optional("CORS_ORIGIN", "http://localhost:5173"),

  adminApiKey: process.env.ADMIN_API_KEY ?? "",

  /** SMTP for admin password reset emails (optional) */
  smtpHost: pick("SMTP_HOST") ?? "",
  smtpPort: Number(pick("SMTP_PORT") ?? "0"),
  smtpUser: pick("SMTP_USER") ?? "",
  smtpPass: pick("SMTP_PASS") ?? "",
  smtpFrom: pick("SMTP_FROM") ?? "",
  smtpSecure: pick("SMTP_SECURE") === "true" || pick("SMTP_SECURE") === "1",

  adminUsername: pick("ADMIN_USERNAME") ?? "",
  adminPassword: pick("ADMIN_PASSWORD") ?? "",
  adminDisplayName: pick("ADMIN_DISPLAY_NAME") ?? "Site Administrator",

  /** Signs admin session tokens (JWT_SECRET_KEY or ADMIN_API_KEY). */
  get sessionSecret(): string {
    return pick("JWT_SECRET_KEY", "ADMIN_API_KEY") ?? "";
  },

  jwtSecret: process.env.JWT_SECRET_KEY ?? "",

  /** Base URL for password-reset links (e.g. http://localhost:8080) */
  publicAppUrl: pick("PUBLIC_APP_URL", "APP_URL")?.trim() ?? "",

  ai: {
    pollinationsUrl: optional("AI_POLLINATIONS_URL", "https://text.pollinations.ai/"),
    systemPrompt: process.env.AI_SYSTEM_PROMPT ?? "",
  },
};

export function assertDbConfig(): void {
  if (!env.mysql.database) {
    throw new Error("DB_NAME or MYSQL_DATABASE is required");
  }
  if (!env.mysql.host) {
    throw new Error("DB_HOST or MYSQL_HOST is required");
  }
}

export function requireAdminKey(): string {
  if (!env.adminApiKey) {
    throw new Error("ADMIN_API_KEY is not configured");
  }
  return env.adminApiKey;
}

export function isAdminLoginConfigured(): boolean {
  return Boolean(env.sessionSecret);
}
