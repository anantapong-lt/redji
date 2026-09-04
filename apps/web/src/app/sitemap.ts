import type { MetadataRoute } from 'next'
import { getPublicContentSitemap } from '@/controllers/content.controller'
import { SITE_CONFIG } from '@/site.config'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const home: MetadataRoute.Sitemap = [
    {
      url: SITE_CONFIG.siteUrl,
      changeFrequency: 'daily',
      priority: 1,
    },
  ]

  try {
    const { contents } = await getPublicContentSitemap()
    return [
      ...home,
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
    return home
  }
}
