import { Router } from "express";
import { z } from "zod";

import { env } from "../config/env.js";
import { getPool } from "../db/pool.js";
import { newId } from "../utils/id.js";
import { fail, ok } from "../utils/http.js";

const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant representing Prasanth Raju, Advocate and Counsel practising before the Bombay High Court and Supreme Court of India.

Prasanth's expertise: Arbitration & International Dispute Resolution (MCIArb), GST & Indirect Taxation, Economic Offences (PMLA, FEMA), Corporate & Commercial Law, Family Law & Mediation, Employment & Labour Law.

Instructions:
- Provide accurate, helpful general information about Indian law
- Always state clearly this is general information, not specific legal advice
- After answering, recommend consulting Prasanth for specific matters
- Be concise: 2-3 paragraphs max`;

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().min(1),
    }),
  ),
  channel: z.enum(["qa", "floating_chat"]).optional(),
  session_id: z.string().max(100).optional(),
});

export const aiRouter = Router();

/** Proxy for site.html callClaude() — optional; frontend unchanged until wired */
aiRouter.post("/chat", async (req, res, next) => {
  try {
    const body = chatSchema.parse(req.body);
    const systemPrompt = env.ai.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const lastUser = [...body.messages].reverse().find((m) => m.role === "user");

    const fullMessages = [
      { role: "system" as const, content: systemPrompt },
      ...body.messages.filter((m) => m.role !== "system"),
    ];

    const resp = await fetch(env.ai.pollinationsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: fullMessages, model: "openai" }),
    });

    if (!resp.ok) {
      fail(res, "AI service unavailable", 502);
      return;
    }

    const answer = (await resp.text()) || "Unable to process that request.";

    if (lastUser) {
      try {
        const pool = getPool();
        await pool.query(
          `INSERT INTO ai_chat_logs (id, session_id, channel, user_message, assistant_message)
           VALUES (:id, :session_id, :channel, :user_message, :assistant_message)`,
          {
            id: newId(),
            session_id: body.session_id ?? null,
            channel: body.channel ?? "qa",
            user_message: lastUser.content,
            assistant_message: answer,
          },
        );
      } catch {
        // logging optional if table missing
      }
    }

    ok(res, { answer });
  } catch (e) {
    next(e);
  }
});
