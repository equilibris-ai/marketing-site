/*
 * Thin, fail-safe wrapper around the GA4 tag loaded in app/layout.tsx.
 * Analytics must never break the page: if the tag is blocked or still
 * loading, the event is silently dropped.
 */

declare global {
  interface Window {
    gtag?: (
      command: "event",
      name: string,
      params?: Record<string, unknown>,
    ) => void;
  }
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  try {
    window.gtag?.("event", name, params);
  } catch {
    /* ignore */
  }
}
