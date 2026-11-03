import Image from "next/image";
import Link from "next/link";

/* Brand bar shared by every page: logo mark, wordmark, beta badge, and the
   divider rule beneath it. */
export default function SiteHeader() {
  return (
    <>
      <header>
        <div className="wrap bar">
          <Link className="logo" href="/" aria-label="Equilibris">
            <Image
              src="/assets/images/logos/equilibris-logo-horizontal.svg"
              alt="Equilibris"
              width={1460}
              height={292}
              priority
            />
          </Link>
          <div className="badge">Private beta &middot; US small business owners</div>
        </div>
      </header>

      <div className="wrap">
        <div className="rule" />
      </div>
    </>
  );
}
