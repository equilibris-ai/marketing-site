import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

// Google Analytics 4 measurement ID. Public by design (it ships in the page),
// so it lives here rather than in the environment.
const GA_MEASUREMENT_ID = "G-LWHJF30VGP";

// Inter powers the whole static page (same face the public/index.html
// template loads from Google Fonts; here it's self-hosted via next/font).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://equilibris.ai"),
  title: "Equilibris",
  description:
    "Real-time tax engine for people who run their own business. Join the early-access waitlist.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Equilibris",
    description:
      "Real-time tax engine for people who run their own business. Join the early-access waitlist.",
    images: ["/assets/images/logos/equilibris-logo-full.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0f19",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}

        {/* Google tag (gtag.js) — loaded after hydration so it never blocks
            first paint. */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());

gtag('config', '${GA_MEASUREMENT_ID}');`}
        </Script>
      </body>
    </html>
  );
}
