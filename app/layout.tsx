import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

// Google Analytics 4 measurement ID. Public by design (it ships in the page),
// so it lives here rather than in the environment.
const GA_MEASUREMENT_ID = 'G-LWHJF30VGP'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
})

const description =
  'Real-time tax engine for freelancers and small-business owners. See what you owe as you earn. Join the early-access waitlist.'

export const metadata: Metadata = {
  metadataBase: new URL('https://equilibris.ai'),
  title: {
    default: 'Equilibris | Real-time tax engine for small business owners',
    template: '%s | Equilibris'
  },
  description,
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png'
  },
  openGraph: {
    title: 'Equilibris | Real-time tax engine for small business owners',
    description,
    url: '/',
    siteName: 'Equilibris',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/assets/images/og/equilibris-og.png',
        width: 1200,
        height: 630,
        alt: 'Equilibris, a real-time tax engine'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Equilibris | Real-time tax engine for small business owners',
    description,
    images: ['/assets/images/og/equilibris-og.png']
  }
}

export const viewport: Viewport = {
  themeColor: '#0b0f19'
}

export default function RootLayout ({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang='en' className={inter.variable}>
      <body>
        <script
          type='application/ld+json'
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Equilibris',
              url: 'https://equilibris.ai',
              logo: 'https://equilibris.ai/assets/images/logos/equilibris-logo-og.png'
            })
          }}
        />
        {children}

        {/* Google tag (gtag.js) — loaded after hydration so it never blocks
            first paint. */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy='afterInteractive'
        />
        <Script id='google-analytics' strategy='afterInteractive'>
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());

gtag('config', '${GA_MEASUREMENT_ID}');`}
        </Script>
      </body>
    </html>
  )
}
