import type { MetadataRoute } from 'next'

export default function sitemap (): MetadataRoute.Sitemap {
  return [{ url: 'https://equilibris.ai', lastModified: new Date() }]
}
