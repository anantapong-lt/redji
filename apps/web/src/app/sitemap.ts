import type { MetadataRoute } from 'next'
import { SITE_CONFIG } from '@/site.config'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_CONFIG.siteUrl,
      changeFrequency: 'daily',
      priority: 1,
    },
  ]
}
