import type { Metadata } from 'next'
import type { PublicChapter, PublicContent } from '@/interface/content.interface'
import { SITE_CONFIG } from '@/site.config'

export const CONTENT_TYPE_LABELS = {
  novel: 'นิยาย',
  manga: 'การ์ตูน',
} as const

export function absoluteSiteUrl(value: string) {
  return new URL(value, SITE_CONFIG.siteUrl).toString()
}

export function getContentDescription(story: PublicContent) {
  const fallback = `${story.title} โดย ${story.author.display_name} อ่านรายละเอียดและเรื่องย่อได้ที่ ${SITE_CONFIG.name}`
  const description = story.synopsis?.trim() || fallback
  const characters = Array.from(description)

  return characters.length > 160
    ? `${characters.slice(0, 157).join('')}...`
    : description
}

export function createContentMetadata(story: PublicContent): Metadata {
  const canonicalPath = `/content/${encodeURIComponent(story.slug)}`
  const description = getContentDescription(story)
  const genres = [story.primary_genre.name, story.secondary_genre?.name]
    .filter((genre): genre is string => Boolean(genre))
  const images = story.cover_url
    ? [{ url: absoluteSiteUrl(story.cover_url), alt: `ปกเรื่อง ${story.title}` }]
    : undefined

  return {
    title: story.title,
    description,
    applicationName: SITE_CONFIG.name,
    authors: [{ name: story.author.display_name }],
    keywords: [
      story.title,
      story.author.display_name,
      CONTENT_TYPE_LABELS[story.type],
      ...genres,
      'อ่านออนไลน์',
    ],
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: 'article',
      locale: 'th_TH',
      siteName: SITE_CONFIG.name,
      title: story.title,
      description,
      url: canonicalPath,
      images,
      publishedTime: story.published_at ?? undefined,
      modifiedTime: story.updated_at,
      tags: genres,
    },
    twitter: {
      card: story.cover_url ? 'summary_large_image' : 'summary',
      title: story.title,
      description,
      images: story.cover_url ? [absoluteSiteUrl(story.cover_url)] : undefined,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    category: CONTENT_TYPE_LABELS[story.type],
  }
}

export function createContentStructuredData(
  story: PublicContent,
  chapters: PublicChapter[] = [],
) {
  const genres = story.secondary_genre
    ? [story.primary_genre, story.secondary_genre]
    : [story.primary_genre]
  const canonicalUrl = absoluteSiteUrl(`/content/${encodeURIComponent(story.slug)}`)

  return {
    '@context': 'https://schema.org',
    '@type': story.type === 'novel' ? 'Book' : 'ComicStory',
    '@id': `${canonicalUrl}#story`,
    url: canonicalUrl,
    name: story.title,
    headline: story.title,
    description: getContentDescription(story),
    image: story.cover_url ? absoluteSiteUrl(story.cover_url) : undefined,
    inLanguage: 'th',
    datePublished: story.published_at ?? undefined,
    dateModified: story.updated_at,
    genre: genres.map((genre) => genre.name),
    numberOfItems: Number(story.chapter_count),
    hasPart: chapters.map((chapter) => ({
      '@type': story.type === 'novel' ? 'Chapter' : 'ComicStory',
      name: chapter.title,
      position: Number(chapter.chapter_number),
      datePublished: chapter.published_at,
    })),
    author: {
      '@type': 'Person',
      name: story.author.display_name,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.siteUrl,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    audience: {
      '@type': 'Audience',
      suggestedMinAge: story.age_rating ?? 0,
    },
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/ReadAction',
      userInteractionCount: Number(story.total_views),
    },
  }
}
