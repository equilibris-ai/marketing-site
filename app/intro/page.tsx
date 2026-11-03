import type { Metadata } from "next";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import YouTubeVideo from "@/components/youtube-video";

/*
 * /intro — the introduction video, framed by the site's header and footer.
 * The embed spans the nav width at 16:9 (see .video in globals.css) and
 * reports video_start / video_complete to GA4.
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
          <YouTubeVideo videoId="ko1Vp_gManw" title="Equilibris introduction video" />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
