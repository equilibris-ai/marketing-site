/*
 * Social-preview (Open Graph / Twitter card) defaults shared by every route.
 *
 * Next.js replaces — does not merge — a parent's `openGraph` object when a
 * page sets its own, so pages must spread `siteOpenGraph` or they lose the
 * preview image.
 */

export const socialImage = {
  url: "/assets/images/og/equilibris-og-horizontal.png",
  width: 1200,
  height: 630,
  alt: "Equilibris logo",
};

export const siteOpenGraph = {
  siteName: "Equilibris",
  type: "website" as const,
  locale: "en_US",
  images: [socialImage],
};
