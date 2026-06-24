import type { Metadata, Viewport } from "next";
import { Dosis } from "next/font/google";
import "./globals.css";

// Dosis (SemiBold-led) powers the UI / body type; the local Faire SprigSans
// and Maple Mono faces are declared in globals.css.
const dosis = Dosis({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dosis",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://equilibris.ai"),
  title: "Equilibris — Your taxes, at your fingertips",
  description:
    "Tax strategy for people with real complexity — businesses, rental properties, and everything in between. Automatic strategy selection, always a human at the end of the line.",
  icons: {
    icon: "/assets/images/logos/equilibris-logo-symbol.png",
  },
  openGraph: {
    title: "Equilibris — Your taxes, at your fingertips",
    description:
      "Automatic strategy selection for complex returns. Always a human at the end of the line.",
    images: ["/assets/images/logos/equilibris-logo-full.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#06080f",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={dosis.variable}>
      <body>{children}</body>
    </html>
  );
}
