"use client";

import { trackEvent } from "@/lib/analytics";

/*
 * The waitlist CTA. It keeps the `#get-quote` id the qualified.at embed
 * attaches its overlay to — this handler runs alongside that one, so the
 * analytics event fires on the press itself whether or not the visitor goes
 * on to finish (or even start) the questionnaire.
 */

export default function WaitlistButton() {
  return (
    <button
      type="button"
      id="get-quote"
      className="cta-btn"
      onClick={() => trackEvent("pressed_waitlist_button")}
    >
      Join the waitlist
    </button>
  );
}
