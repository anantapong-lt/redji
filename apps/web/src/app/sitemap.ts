import type { MetadataRoute } from 'next'
import { getPublicContentSitemap } from '@/controllers/content.controller'
import { SITE_CONFIG } from '@/site.config'
import { getServerFeatureConfig } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const features = await getServerFeatureConfig()
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_CONFIG.siteUrl,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: new URL('/topup', SITE_CONFIG.siteUrl).toString(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: new URL('/login', SITE_CONFIG.siteUrl).toString(),
      changeFrequency: 'yearly',
      priority: 0.6,
    },
    ...(features?.registration ? [{
      url: new URL('/register', SITE_CONFIG.siteUrl).toString(),
      changeFrequency: 'yearly' as const,
      priority: 0.6,
    }] : []),
  ]

  try {
    const { contents } = await getPublicContentSitemap()
    return [
      ...staticPages,
      ...contents.map((content) => ({
        url: new URL(`/content/${encodeURIComponent(content.slug)}`, SITE_CONFIG.siteUrl).toString(),
        lastModified: content.updated_at,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
        images: content.cover_url
          ? [new URL(content.cover_url, SITE_CONFIG.siteUrl).toString()]
          : undefined,
      })),
    ]
  } catch (error) {
    console.error('Unable to generate content sitemap', error)
    return staticPages
  }
}
