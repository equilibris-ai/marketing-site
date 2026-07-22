import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
    icon: "/_logo_sm.png",
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
      <body>{children}</body>
    </html>
  );
}
