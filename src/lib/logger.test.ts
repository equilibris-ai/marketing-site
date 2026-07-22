import { describe, expect, it } from "bun:test";
import { createLogger } from "@/lib/logger";

// Smoke test: keeps `bun test` meaningful now that the DB-era suites are gone.
describe("createLogger", () => {
  it("returns a tagged logger with the standard methods", () => {
    const log = createLogger("test");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
  });
});
