import { Resend } from "resend";
import { baseUrl, verificationUrl } from "@/lib/verification";
import { createLogger } from "@/lib/logger";
import { withSpan } from "@/lib/tracing";

const FROM = process.env.EMAIL_FROM ?? "Equilibris <onboarding@resend.dev>";
// Optional. Where human replies should go (the From subdomain is send-only).
const REPLY_TO = process.env.EMAIL_REPLY_TO || undefined;
const log = createLogger("email");

/** Absolute URL to a file in /public — emails can't use relative asset paths. */
function asset(path: string): string {
  const base = baseUrl();
  const origin = base.startsWith("http") ? base : `https://${base}`;
  return `${origin}${path}`;
}

/**
 * Send the double-opt-in verification email.
 *
 * Uses Resend when RESEND_API_KEY is set. Without a key (e.g. local dev before
 * you've signed up), it falls back to logging the verification link to the
 * server console so the flow is still testable.
 */
export async function sendVerificationEmail(params: {
  to: string;
  name?: string | null;
  rawToken: string;
}): Promise<void> {
  const link = verificationUrl(params.rawToken);
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    log.warn(`RESEND_API_KEY not set — skipping send. Verification link for ${params.to}: ${link}`);
    return;
  }

  const greeting = params.name ? `Hi ${params.name},` : "Hi,";
  const resend = new Resend(apiKey);
  log.start(`Sending verification email to ${params.to} via Resend`);

  await withSpan(
    "email.send_verification",
    { "app.email.provider": "resend", "app.email.to": params.to },
    async (span) => {
      const { data, error } = await resend.emails.send({
        from: FROM,
        to: params.to,
        ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
        subject: "Confirm your email — Equilibris",
        text: `${greeting}\n\nConfirm your email to join the Equilibris waitlist:\n${link}\n\nIf you didn't request this, you can ignore this email.`,
        html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#0b1020">
        <h2 style="margin:0 0 12px">Confirm your email</h2>
        <p style="margin:0 0 8px">${greeting}</p>
        <p style="margin:0 0 20px;color:#3a4256">Tap the button to confirm your email and join the Equilibris waitlist.</p>
        <p style="margin:0 0 24px">
          <a href="${link}" style="background:#1566dc;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">Confirm email</a>
        </p>
        <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Or paste this link into your browser:</p>
        <p style="margin:0 0 24px;font-size:13px;word-break:break-all"><a href="${link}" style="color:#1566dc">${link}</a></p>
        <p style="margin:0;color:#9aa1ab;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
      });

      if (error) {
        span.setAttribute("app.email.sent", false);
        span.setAttribute("exception.slug", "err-resend-send-failed");
        log.error(`Resend send failed for ${params.to}: ${error.message}`);
        throw new Error(`Resend send failed: ${error.message}`);
      }

      span.setAttribute("app.email.sent", true);
      if (data?.id) span.setAttribute("app.email.message_id", data.id);
      log.success(`Verification email sent to ${params.to}`);
    },
  );
}

/**
 * Send the post-confirmation welcome email. Best-effort: callers should treat a
 * failure as non-fatal (the lead is already verified) and not surface it to the
 * user. Falls back to a console log when RESEND_API_KEY is unset.
 */
export async function sendWelcomeEmail(params: {
  to: string;
  name?: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log.warn(`RESEND_API_KEY not set — skipping welcome email for ${params.to}`);
    return;
  }

  const logoUrl = asset("/assets/images/logos/equilibris-logo-full.png");
  const resend = new Resend(apiKey);
  log.start(`Sending welcome email to ${params.to} via Resend`);

  await withSpan(
    "email.send_welcome",
    { "app.email.provider": "resend", "app.email.kind": "welcome", "app.email.to": params.to },
    async (span) => {
      const { data, error } = await resend.emails.send({
        from: FROM,
        to: params.to,
        ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
        subject: "Thank you for signing up — Equilibris",
        text: `Thank you for signing up! We'll let you know as soon as the MVP is live!\n\n— Equilibris.ai Team`,
        html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#0b1020;text-align:center">
        <img src="${logoUrl}" alt="Equilibris" width="200" style="max-width:200px;height:auto;margin:8px auto 24px;display:block" />
        <p style="margin:0 0 16px;font-size:17px;line-height:1.5">Thank you for signing up! We&rsquo;ll let you know as soon as the MVP is live!</p>
        <p style="margin:24px 0 0;color:#3a4256;font-weight:600">&mdash; Equilibris.ai Team</p>
      </div>
    `,
      });

      if (error) {
        span.setAttribute("app.email.sent", false);
        span.setAttribute("exception.slug", "err-resend-send-failed");
        log.error(`Resend welcome send failed for ${params.to}: ${error.message}`);
        throw new Error(`Resend welcome send failed: ${error.message}`);
      }

      span.setAttribute("app.email.sent", true);
      if (data?.id) span.setAttribute("app.email.message_id", data.id);
      log.success(`Welcome email sent to ${params.to}`);
    },
  );
}
