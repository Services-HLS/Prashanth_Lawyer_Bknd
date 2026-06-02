import { randomBytes } from "crypto";
import { mkdirSync } from "fs";
import path from "path";

import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";

import { adminAuth } from "../middleware/adminAuth.js";
import { fail, ok } from "../utils/http.js";

const uploadsDir = path.join(process.cwd(), "uploads");
mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext)
      ? ext
      : ".jpg";
    const name = `${Date.now()}-${randomBytes(6).toString("hex")}${safeExt}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

export const uploadsRouter = Router();

uploadsRouter.use(adminAuth);

/** POST multipart field `images` (multiple) — saves to disk, returns public URLs */
uploadsRouter.post("/", upload.array("images", 12), (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) {
    fail(res, "No images uploaded. Use form field name: images", 400);
    return;
  }

  const urls = files.map((f) => `/uploads/${f.filename}`);
  ok(res, { urls });
});

uploadsRouter.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      fail(res, "Image too large (max 8MB per file)", 400);
      return;
    }
    fail(res, err.message, 400);
    return;
  }
  if (err instanceof Error) {
    fail(res, err.message, 400);
    return;
  }
  next(err);
});
