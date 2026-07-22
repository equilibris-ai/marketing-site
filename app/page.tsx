import Image from "next/image";
import Script from "next/script";

/*
 * Static landing page — a 1:1 port of public/index.html (the design source
 * of truth). No form, no backend: lead capture happens in the qualified.at
 * questionnaire widget, which attaches to the #get-quote button.
 */

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
                  data-trigger="element" / data-element="#get-quote". */}
              <button type="button" id="get-quote" className="cta-btn">
                Join the waitlist
              </button>
              <p className="fine">
              No spam. Early access invites go out first-come. Unsubscribe anytime.
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

      {/* qualified.at questionnaire widget: the inquirex-js bundle plus the
          signed embed loader that attaches the overlay to #get-quote. */}
      <Script
        src="https://qualified.at/inquirex-js/bda2534d-96bb-4429-8e98-378c89aeab1b"
        strategy="afterInteractive"
      />
      <Script
        src="https://qualified.at/embed/6fb854ce30826a9b5e38ad5e3cc5a939?origin=https%3A%2F%2Fequilibris.ai&sig=08bcb719e41a58af095aec5abcbc2a3b291713a01d91bb2afbbdf03fe3a47e79"
        strategy="afterInteractive"
        data-trigger="element"
        data-element="#get-quote"
      />
    </>
  );
}
