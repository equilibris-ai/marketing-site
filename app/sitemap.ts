import type { MetadataRoute } from 'next'

export default function sitemap (): MetadataRoute.Sitemap {
  return [
    { url: 'https://equilibris.ai', lastModified: new Date() },
    { url: 'https://equilibris.ai/intro', lastModified: new Date() }
  ]
}
