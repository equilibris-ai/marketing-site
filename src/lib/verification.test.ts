import { describe, test, expect, afterEach } from "bun:test";
import { createHash } from "node:crypto";
import {
  createVerificationToken,
  hashToken,
  baseUrl,
  verificationUrl,
  TOKEN_TTL_MS,
} from "./verification";

describe("hashToken", () => {
  test("is a 64-char sha256 hex digest", () => {
    const digest = hashToken("hello");
    expect(digest).toHaveLength(64);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toBe(createHash("sha256").update("hello").digest("hex"));
  });

  test("is deterministic", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  test("differs for different input", () => {
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});

describe("createVerificationToken", () => {
  test("stores the hash of the raw token, never the raw value", () => {
    const { raw, hash } = createVerificationToken();
    expect(hash).toBe(hashToken(raw));
    expect(hash).not.toBe(raw);
  });

  test("produces a unique raw token each call", () => {
    expect(createVerificationToken().raw).not.toBe(createVerificationToken().raw);
  });

  test("expires roughly TOKEN_TTL_MS in the future", () => {
    const before = Date.now();
    const { expiresAt } = createVerificationToken();
    const delta = expiresAt.getTime() - before;
    expect(delta).toBeGreaterThan(TOKEN_TTL_MS - 1000);
    expect(delta).toBeLessThanOrEqual(TOKEN_TTL_MS + 1000);
  });
});

describe("baseUrl / verificationUrl", () => {
  const SITE = process.env.NEXT_PUBLIC_SITE_URL;
  const VERCEL = process.env.VERCEL_PROJECT_PRODUCTION_URL;

  afterEach(() => {
    // Restore the environment between cases so order can't leak state.
    restore("NEXT_PUBLIC_SITE_URL", SITE);
    restore("VERCEL_PROJECT_PRODUCTION_URL", VERCEL);
  });

  function restore(key: string, value: string | undefined) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  test("uses NEXT_PUBLIC_SITE_URL and strips a trailing slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://equilibris.ai/";
    expect(baseUrl()).toBe("https://equilibris.ai");
  });

  test("falls back to localhost when nothing is set", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(baseUrl()).toBe("http://localhost:3000");
  });

  test("verificationUrl builds an absolute, token-encoded link", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://equilibris.ai";
    expect(verificationUrl("a b+c/d")).toBe(
      "https://equilibris.ai/api/verify?token=a%20b%2Bc%2Fd",
    );
  });

  test("verificationUrl prepends https:// when the base has no protocol", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "equilibris.vercel.app";
    expect(verificationUrl("tok")).toBe(
      "https://equilibris.vercel.app/api/verify?token=tok",
    );
  });
});
