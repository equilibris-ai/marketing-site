import type { Metadata } from "next";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";

/*
 * /intro — the introduction video, framed by the site's header and footer.
 * The embed scales to the content width at a fixed 16:9 ratio (see .video
 * in globals.css) instead of the fixed 560×315 YouTube snippet size.
 */

export const metadata: Metadata = {
  title: "Intro",
  description: "A short video introduction to Equilibris, the real-time tax engine for small-business owners.",
  alternates: { canonical: "/intro" },
  openGraph: { url: "/intro" },
};

export default function Intro() {
  return (
    <>
      <SiteHeader />

      <main>
        <div className="wrap">
          <div className="video">
            <iframe
              src="https://www.youtube.com/embed/ko1Vp_gManw?si=6oTjNck_5IRo3w-u"
              title="Equilibris introduction video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
