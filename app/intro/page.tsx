import type { Metadata } from "next";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import YouTubeVideo from "@/components/youtube-video";
import { siteOpenGraph } from "@/lib/social";

/*
 * /intro — the introduction video, framed by the site's header and footer.
 * The embed spans the nav width at 16:9 (see .video in globals.css) and
 * reports video_start / video_complete to GA4.
 */

const title = "Intro";
const description =
  "A short video introduction to Equilibris, the real-time tax engine for small-business owners.";

// Video still (with play button) instead of the site-wide logo card.
const previewImage = {
  url: "/assets/images/og/equilibris-video-preview.jpg",
  width: 1200,
  height: 675,
  alt: "Equilibris introduction video",
};

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/intro" },
  openGraph: {
    ...siteOpenGraph,
    title: `${title} | Equilibris`,
    description,
    url: "/intro",
    images: [previewImage],
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | Equilibris`,
    description,
    images: [previewImage],
  },
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
