import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { isAdminLoginConfigured } from "../config/env.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { createAdminSession } from "../services/adminSession.js";
import {
  findAdminById,
  findAdminByLogin,
  touchLastLogin,
  updateAdminPassword,
  verifyPassword,
} from "../services/adminUsers.js";
import { fail, ok } from "../utils/http.js";

export const authRouter = Router();

function isMissingAdminTableError(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "ER_NO_SUCH_TABLE",
  );
}

function tryEnvAdminLogin(loginId: string, password: string):
  | {
      id: string;
      email: string;
      fullName: string;
      role: "admin";
    }
  | null {
  const envUser = env.adminUsername?.trim();
  const envPass = env.adminPassword ?? "";
  if (!envUser || !envPass) return null;

  const asEmail = envUser.includes("@") ? envUser : `${envUser}@admin.local`;
  const login = loginId.trim().toLowerCase();
  const matchedLogin = login === envUser.toLowerCase() || login === asEmail.toLowerCase();
  const matchedPass = password === envPass;
  if (!matchedLogin || !matchedPass) return null;

  return {
    id: "env-admin",
    email: asEmail,
    fullName: env.adminDisplayName || "Site Administrator",
    role: "admin",
  };
}

const loginSchema = z
  .object({
    username: z.string().optional(),
    email: z.string().optional(),
    password: z.string().min(1, "Password is required"),
  })
  .refine((data) => Boolean((data.email ?? data.username ?? "").trim()), {
    message: "Email is required",
    path: ["email"],
  });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

const forgotSchema = z.object({
  email: z.string().email("Enter a valid email"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters"),
});


authRouter.post("/login", async (req, res, next) => {
  try {
    if (!isAdminLoginConfigured()) {
      fail(res, "Admin login is not configured — set JWT_SECRET_KEY in backend/.env", 503);
      return;
    }

    const body = loginSchema.parse(req.body);
    const loginId = (body.email ?? body.username ?? "").trim();
    const { password } = body;

    // Always allow env-admin fallback first (useful when DB auth tables are missing/misaligned).
    const envAdmin = tryEnvAdminLogin(loginId, password);
    if (envAdmin) {
      const token = createAdminSession({ id: envAdmin.id, email: envAdmin.email });
      ok(res, {
        token,
        username: envAdmin.email,
        email: envAdmin.email,
        fullName: envAdmin.fullName,
        role: envAdmin.role,
      });
      return;
    }

    let user = null;
    try {
      user = await findAdminByLogin(loginId);
    } catch (err) {
      if (!isMissingAdminTableError(err)) throw err;
      user = null;
    }
    if (!user) {
      fail(res, "Invalid email or password", 401);
      return;
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      fail(res, "Invalid email or password", 401);
      return;
    }

    await touchLastLogin(user.id);
    const token = createAdminSession({ id: user.id, email: user.email });
    ok(res, {
      token,
      username: user.email,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    });
  } catch (e) {
    next(e);
  }
});

authRouter.get("/verify", adminAuth, async (req, res, next) => {
  try {
    const userId = req.adminUserId;
    if (!userId) {
      ok(res, { valid: true, username: req.adminUser ?? null });
      return;
    }
    const user = await findAdminById(userId);
    ok(res, {
      valid: true,
      username: user?.email ?? req.adminUser,
      email: user?.email,
      fullName: user?.full_name,
      role: user?.role,
    });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/change-password", adminAuth, async (req, res, next) => {
  try {
    const userId = req.adminUserId;
    if (!userId) {
      fail(res, "Unauthorized", 401);
      return;
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await findAdminById(userId);
    if (!user) {
      fail(res, "User not found", 404);
      return;
    }

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      fail(res, "Current password is incorrect", 400);
      return;
    }

    await updateAdminPassword(userId, newPassword);
    ok(res, { updated: true });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/forgot-password", async (req, res, next) => {
  try {
    if (!isAdminLoginConfigured()) {
      fail(res, "Admin login is not configured", 503);
      return;
    }

    const { email, newPassword, confirmPassword } = forgotSchema.parse(req.body);
    if (newPassword !== confirmPassword) {
      fail(res, "New password and confirm password must match", 400);
      return;
    }

    const user = await findAdminByLogin(email);
    if (!user) {
      fail(res, "Admin account not found for this email", 404);
      return;
    }

    await updateAdminPassword(user.id, newPassword);
    ok(res, { message: "Password updated successfully. You can sign in now." });
  } catch (e) {
    next(e);
  }
});

