import { Router } from "express";
import { z } from "zod";

import { getPool } from "../db/pool.js";
import { newId } from "../utils/id.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { ok } from "../utils/http.js";

export const formsRouter = Router();

/** Accepts API names or site.html input ids (nlName, cName, …) when frontend is wired */
const newsletterSchema = z
  .object({
    name: z.string().max(200).optional(),
    nlName: z.string().max(200).optional(),
    email: z.string().email().max(320).optional(),
    nlEmail: z.string().email().max(320).optional(),
    interest: z.string().max(200).optional(),
    nlInterest: z.string().max(200).optional(),
  })
  .transform((b) => ({
    name: (b.name ?? b.nlName)?.trim() || undefined,
    email: (b.email ?? b.nlEmail ?? "").trim(),
    interest: (b.interest ?? b.nlInterest)?.trim() || undefined,
  }))
  .refine((b) => b.email.length > 0, { message: "Email is required" });

const contactSchema = z
  .object({
    name: z.string().max(200).optional(),
    cName: z.string().max(200).optional(),
    email: z.string().email().max(320).optional(),
    cEmail: z.string().email().max(320).optional(),
    matter_type: z.string().max(200).optional(),
    cMatter: z.string().max(200).optional(),
    message: z.string().max(10000).optional(),
    cMessage: z.string().max(10000).optional(),
    contact_preference: z.string().max(100).optional(),
    cContact: z.string().max(100).optional(),
  })
  .transform((b) => ({
    name: (b.name ?? b.cName ?? "").trim(),
    email: (b.email ?? b.cEmail ?? "").trim(),
    matter_type: (b.matter_type ?? b.cMatter)?.trim() || undefined,
    message: (b.message ?? b.cMessage)?.trim() || undefined,
    contact_preference: (b.contact_preference ?? b.cContact)?.trim() || undefined,
  }))
  .refine((b) => b.name.length > 0, { message: "Name is required" })
  .refine((b) => b.email.length > 0, { message: "Email is required" });

function clientMeta(req: { ip?: string; headers: Record<string, unknown> }) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : req.ip ?? null;
  const userAgent = req.headers["user-agent"];
  return {
    ip_address: ip,
    user_agent: typeof userAgent === "string" ? userAgent.slice(0, 500) : null,
  };
}

/** site.html subscribeNewsletter() */
formsRouter.post("/newsletter", async (req, res, next) => {
  try {
    const body = newsletterSchema.parse(req.body);
    const meta = clientMeta(req);
    const pool = getPool();

    await pool.query(
      `INSERT INTO newsletter_subscriptions (id, name, email, interest, status, ip_address, user_agent)
       VALUES (:id, :name, :email, :interest, 'active', :ip_address, :user_agent)`,
      {
        id: newId(),
        name: body.name ?? null,
        email: body.email,
        interest: body.interest ?? null,
        ...meta,
      },
    );

    ok(res, {
      message: "Subscribed successfully",
      email: body.email,
    });
  } catch (e) {
    next(e);
  }
});

/** site.html handleContact() */
formsRouter.post("/contact", async (req, res, next) => {
  try {
    const body = contactSchema.parse(req.body);
    const meta = clientMeta(req);
    const pool = getPool();

    await pool.query(
      `INSERT INTO contact_inquiries
        (id, name, email, matter_type, message, contact_preference, status, ip_address, user_agent)
       VALUES
        (:id, :name, :email, :matter_type, :message, :contact_preference, 'new', :ip_address, :user_agent)`,
      {
        id: newId(),
        name: body.name,
        email: body.email,
        matter_type: body.matter_type ?? null,
        message: body.message ?? null,
        contact_preference: body.contact_preference ?? null,
        ...meta,
      },
    );

    ok(res, {
      message: "Thank you. We will respond within 24–48 hours.",
    });
  } catch (e) {
    next(e);
  }
});

const admin = Router();
admin.use(adminAuth);

/** Admin: list newsletter subscribers */
admin.get("/newsletter", async (_req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT * FROM newsletter_subscriptions ORDER BY subscribed_at DESC LIMIT 500`,
    );
    ok(res, rows);
  } catch (e) {
    next(e);
  }
});

/** Admin: list contact inquiries */
admin.get("/contact", async (_req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT * FROM contact_inquiries ORDER BY created_at DESC LIMIT 500`,
    );
    ok(res, rows);
  } catch (e) {
    next(e);
  }
});

formsRouter.use("/admin", admin);
