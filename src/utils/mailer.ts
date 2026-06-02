import nodemailer from "nodemailer";

import { env } from "../config/env.js";

export type PasswordResetEmailData = {
  toEmail: string;
  resetUrl: string;
  expiresAtIso: string;
};

function getSmtpTransport():
  | ReturnType<typeof nodemailer.createTransport>
  | null {
  if (!env.smtpHost || !env.smtpPort || !env.smtpUser || !env.smtpPass || !env.smtpFrom) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
}

export async function sendAdminPasswordResetEmail(
  data: PasswordResetEmailData,
): Promise<{ sent: boolean; transportConfigured: boolean }> {
  const transport = getSmtpTransport();
  if (!transport) {
    // Development fallback: don't reveal the link in the browser, but do log it in server output.
    console.warn(
      "[admin] SMTP not configured. Password reset email not sent. Reset link (dev log):",
    );
    console.warn(data.resetUrl);
    return { sent: false, transportConfigured: false };
  }

  const subject = "Reset your admin password";
  const text = [
    "You requested an admin password reset.",
    "",
    `Reset link: ${data.resetUrl}`,
    "",
    `This link expires at: ${new Date(data.expiresAtIso).toLocaleString()}`,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0A0F1E;">
      <h2 style="margin:0 0 12px 0;">Reset your admin password</h2>
      <p style="margin:0 0 12px 0;">You requested an admin password reset.</p>
      <p style="margin:0 0 12px 0;">Click the link below to set a new password:</p>
      <p style="margin:0 0 12px 0;">
        <a href="${data.resetUrl}" style="color:#E8522A; font-weight:700;">Reset password</a>
      </p>
      <p style="margin:0 0 12px 0;">Expires: ${new Date(data.expiresAtIso).toLocaleString()}</p>
      <p style="margin:0;">If you did not request this, you can ignore this email.</p>
    </div>
  `;

  await transport.sendMail({
    from: env.smtpFrom,
    to: data.toEmail,
    subject,
    text,
    html,
  });

  return { sent: true, transportConfigured: true };
}

