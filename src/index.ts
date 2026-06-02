import express from "express";
import path from "path";

import { assertDbConfig, env } from "./config/env.js";
import { ensureAdminSchema } from "./services/adminSchema.js";
import { ensurePodcastSchema } from "./services/podcastSchema.js";
import { ensureDefaultAdminFromEnv } from "./services/adminUsers.js";
import { corsHeadersMiddleware, corsMiddleware } from "./middleware/cors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { contentRouter } from "./routes/content.js";
import { apiRouter } from "./routes/index.js";
import { uploadsRouter } from "./routes/uploads.js";
import { fail } from "./utils/http.js";

assertDbConfig();

void (async () => {
  try {
    const { getPool } = await import("./db/pool.js");
    getPool();
    await ensureAdminSchema();
    await ensurePodcastSchema();
    await ensureDefaultAdminFromEnv();
  } catch (err) {
    console.warn("[admin] Auth tables / seed:", (err as Error).message);
  }
})();

const app = express();

app.use(corsHeadersMiddleware);
app.use(corsMiddleware);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsDir));

app.get("/", (_req, res) => {
  okMessage(res);
});

function okMessage(res: express.Response) {
  res.json({
    name: "Prasanth Lawyer API",
    version: "1.0.0",
    docs: "/api/v1/health",
  });
}

/** LexResolve-compatible CMS API (same contract as Lawyer-application-deploy) */
app.use("/api/content", contentRouter);

app.use("/api/v1/uploads", uploadsRouter);
app.use("/api/v1", apiRouter);

app.use((_req, res) => {
  fail(res, "Not found", 404);
});

app.use(errorHandler);

const server = app.listen(env.port, () => {
  const { host, port, user, database } = env.mysql;
  console.log(`API listening on http://localhost:${env.port}`);
  console.log(`Health: http://localhost:${env.port}/api/v1/health`);
  console.log(`CMS (LexResolve): http://localhost:${env.port}/api/content?action=list&type=article`);
  console.log(`Site payload: http://localhost:${env.port}/api/v1/site`);
  console.log(`MySQL: ${user}@${host}:${port}/${database}`);
  if (
    env.isDev &&
    host === "127.0.0.1" &&
    user === "root" &&
    !env.mysql.password
  ) {
    console.warn(
      "Using default local MySQL (root, no password). Set DB_* or MYSQL_* in backend/.env for RDS.",
    );
  }
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\nPort ${env.port} is already in use. Stop the other process:\n` +
        `  Get-NetTCPConnection -LocalPort ${env.port} | Select OwningProcess\n` +
        `  Stop-Process -Id <PID> -Force\n`,
    );
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
