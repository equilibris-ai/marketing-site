"use client";

/*
 * The waitlist CTA. It keeps the `#get-quote` id the qualified.at embed
 * attaches its overlay to — this handler runs alongside that one, so the
 * analytics event fires on the press itself whether or not the visitor goes
 * on to finish (or even start) the questionnaire.
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

export default function WaitlistButton() {
  return (
    <button
      type="button"
      id="get-quote"
      className="cta-btn"
      onClick={() => {
        // Analytics must never take the CTA down with it: if the tag is
        // blocked or still loading, the click just proceeds untracked.
        try {
          window.gtag?.("event", "pressed_waitlist_button");
        } catch {
          /* ignore */
        }
      }}
    >
      Join the waitlist
    </button>
  );
}
