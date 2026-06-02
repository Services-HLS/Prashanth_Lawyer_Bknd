import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";

import { adminAuth } from "../middleware/adminAuth.js";
import { fail, ok } from "../utils/http.js";

const upload = multer({
  storage: multer.memoryStorage(),
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

/** POST multipart field `images` (multiple) — returns data:image/*;base64 URLs for DB storage */
uploadsRouter.post("/", upload.array("images", 12), (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) {
    fail(res, "No images uploaded. Use form field name: images", 400);
    return;
  }

  const urls = files.map((f) => {
    const mime = f.mimetype || "image/jpeg";
    const b64 = f.buffer.toString("base64");
    return `data:${mime};base64,${b64}`;
  });
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
