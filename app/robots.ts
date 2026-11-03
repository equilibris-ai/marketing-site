import type { MetadataRoute } from 'next'

// /intro stays out of search engines, but the link-preview bots that honour
// robots.txt (X, LinkedIn, Facebook) may fetch it so shared links get a card.
const PREVIEW_BOTS = ['Twitterbot', 'LinkedInBot', 'facebookexternalhit']

export default function robots (): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: PREVIEW_BOTS, allow: '/' },
      { userAgent: '*', allow: '/', disallow: '/intro' }
    ],
    sitemap: 'https://equilibris.ai/sitemap.xml'
  }
}
