import { createHash, randomBytes } from "node:crypto";

/** How long an email-verification link stays valid. */
export const TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

/**
 * Generate a verification token pair: the `raw` value goes in the email link,
 * the `hash` is what we store. We never persist the raw token, so a database
 * leak can't be replayed to verify an address.
 */
export function createVerificationToken() {
  const raw = randomBytes(32).toString("base64url");
  const hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  return { raw, hash, expiresAt };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Resolve the public base URL for building absolute verification links. */
export function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function verificationUrl(rawToken: string): string {
  const base = baseUrl().startsWith("http") ? baseUrl() : `https://${baseUrl()}`;
  return `${base}/api/verify?token=${encodeURIComponent(rawToken)}`;
}
