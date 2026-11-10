import type { MetadataRoute } from 'next'

// These pages stay out of search engines, but the link-preview bots that honour
// robots.txt (X, LinkedIn, Facebook) may fetch them so shared links get a card.
// Rules match by prefix, so '/product-map' also covers '/product-map.html'.
const PREVIEW_BOTS = ['Twitterbot', 'LinkedInBot', 'facebookexternalhit']
const HIDDEN_PATHS = ['/intro', '/product-map']

export default function robots (): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: PREVIEW_BOTS, allow: '/' },
      { userAgent: '*', allow: '/', disallow: HIDDEN_PATHS }
    ],
    sitemap: 'https://equilibris.ai/sitemap.xml'
  }
}
