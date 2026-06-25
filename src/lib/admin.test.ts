import { describe, test, expect, afterEach } from "bun:test";
import { isAdminEmail } from "./admin";

describe("isAdminEmail", () => {
  const ORIGINAL = process.env.ADMIN_EMAILS;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = ORIGINAL;
  });

  test("returns false when the allowlist is unset", () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail("a@b.com")).toBe(false);
  });

  test("returns false for null / undefined / empty input", () => {
    process.env.ADMIN_EMAILS = "a@b.com";
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });

  test("matches a listed address", () => {
    process.env.ADMIN_EMAILS = "kig@equilibris.ai";
    expect(isAdminEmail("kig@equilibris.ai")).toBe(true);
  });

  test("is case-insensitive on both the list and the input", () => {
    process.env.ADMIN_EMAILS = "KIG@Equilibris.ai";
    expect(isAdminEmail("kig@equilibris.AI")).toBe(true);
  });

  test("trims whitespace and supports multiple entries", () => {
    process.env.ADMIN_EMAILS = " a@x.com , b@y.com ,c@z.com ";
    expect(isAdminEmail("b@y.com")).toBe(true);
    expect(isAdminEmail("c@z.com")).toBe(true);
  });

  test("rejects an address not on the list", () => {
    process.env.ADMIN_EMAILS = "a@x.com";
    expect(isAdminEmail("intruder@evil.com")).toBe(false);
  });
});
