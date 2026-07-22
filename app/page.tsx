import Image from "next/image";
import Script from "next/script";

/*
 * Static landing page — a 1:1 port of public/index.html (the design source
 * of truth). No form, no backend: lead capture happens in the qualified.at
 * questionnaire widget, which attaches to the #waitlist-cta button.
 */

// Signed embed URL from the qualified.at site dashboard, e.g.
//   https://qualified.at/embed/<embed_token>.js?sig=<HMAC>&origin=https://equilibris.ai
// While null the button is inert (nothing to load yet).
const EMBED_SRC: string | null = null; // TODO: paste signed qualified.at embed URL

export default function Home() {
  return (
    <>
      <header>
        <div className="wrap bar">
          <a className="logo" href="#" aria-label="Equilibris">
            <Image
              src="/_logo_mark.png"
              alt="Equilibris"
              width={300}
              height={317}
              priority
            />
            <span className="word">EQUILIBRIS</span>
          </a>
          <div className="badge">Private beta &middot; US small business owners</div>
        </div>
      </header>

      <main>
        <div className="wrap">
          <section className="hero">
            <div className="eyebrow">
              <span className="dot" /> Real-time tax engine
            </div>
            <h1>
              Built for people who <span className="hl">run their own business.</span>
            </h1>
            <p className="lede">
              We&rsquo;re opening early access soon. Join us if you&rsquo;re a
              small-business owner and want to be first in.
            </p>

            <div className="sub">
              {/* Clicking this button opens the qualified.at questionnaire
                  overlay; the embed script below wires the click via
                  data-trigger="element" / data-element="#waitlist-cta". */}
              <button type="button" id="waitlist-cta" className="cta-btn">
                Join the waitlist
              </button>
              <p className="fine">
                A few quick questions to see if we&rsquo;re a fit. No spam &mdash;
                early access invites go out first-come.
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer>
        <div className="wrap foot">
          <span>&copy; 2026 Equilibris, Inc.</span>
          <span>
            <a href="mailto:waitlist@equilibris.com">waitlist@equilibris.com</a>
          </span>
        </div>
      </footer>

      {EMBED_SRC && (
        <Script
          src={EMBED_SRC}
          strategy="afterInteractive"
          data-trigger="element"
          data-element="#waitlist-cta"
        />
      )}
    </>
  );
}
