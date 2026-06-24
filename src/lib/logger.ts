import { createConsola } from "consola";

/**
 * Backend logger (colorful, tagged) built on consola.
 *
 * Levels: 0 silent · 1 warn/error · 2 normal · 3 info · 4 debug · 5 trace.
 * Override with the LOG_LEVEL env var. Colors auto-disable when output isn't a
 * TTY (e.g. in production log drains), so this is safe to leave on everywhere.
 */
const level =
  process.env.LOG_LEVEL !== undefined ? Number(process.env.LOG_LEVEL) : 3;

export const logger = createConsola({
  level: Number.isFinite(level) ? level : 3,
  formatOptions: { colors: true, date: true, compact: false },
});

/** Create a tagged child logger, e.g. `createLogger("waitlist")`. */
export function createLogger(tag: string) {
  return logger.withTag(tag);
}
