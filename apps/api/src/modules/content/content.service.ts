import { db } from '../../db'
import type { StoryStatus, StoryType } from '../../models/story.model'

export interface PublicContent {
  id: string
  title: string
  slug: string
  synopsis: string | null
  cover_url: string | null
  cover_blur_data_url: string | null
  type: StoryType
  status: StoryStatus
  age_rating: number | null
  total_views: string
  published_at: Date | null
  updated_at: Date
  chapter_count: string
  latest_chapter: {
    id: string
    chapter_number: string
    title: string
    published_at: Date
  } | null
  author: {
    id: string
    username: string
    display_name: string
  }
  primary_genre: {
    id: string
    name: string
    slug: string
  }
  secondary_genre: {
    id: string
    name: string
    slug: string
  } | null
}

export async function findPublicContentBySlug(
  slug: string,
): Promise<PublicContent | undefined> {
  const [story] = await db<PublicContent[]>`
    SELECT
      stories.id,
      stories.title,
      stories.slug,
      stories.synopsis,
      stories.cover_url,
      stories.cover_blur_data_url,
      stories.type,
      stories.status,
      stories.age_rating,
      stories.total_views::TEXT,
      stories.published_at,
      stories.updated_at,
      (
        SELECT COUNT(*)::TEXT
        FROM chapters
        WHERE chapters.story_id = stories.id
          AND chapters.status = 'published'
          AND chapters.published_at <= NOW()
      ) AS chapter_count,
      (
        SELECT json_build_object(
          'id', chapters.id,
          'chapter_number', chapters.chapter_number::TEXT,
          'title', chapters.title,
          'published_at', chapters.published_at
        )
        FROM chapters
        WHERE chapters.story_id = stories.id
          AND chapters.status = 'published'
          AND chapters.published_at <= NOW()
        ORDER BY chapters.chapter_number DESC, chapters.id DESC
        LIMIT 1
      ) AS latest_chapter,
      json_build_object(
        'id', users.id,
        'username', users.username,
        'display_name', users.display_name
      ) AS author,
      json_build_object(
        'id', primary_genre.id,
        'name', primary_genre.name,
        'slug', primary_genre.slug
      ) AS primary_genre,
      CASE
        WHEN secondary_genre.id IS NULL THEN NULL
        ELSE json_build_object(
          'id', secondary_genre.id,
          'name', secondary_genre.name,
          'slug', secondary_genre.slug
        )
      END AS secondary_genre
    FROM stories
    INNER JOIN users ON users.id = stories.creator_user_id
    INNER JOIN genres AS primary_genre ON primary_genre.id = stories.primary_genre_id
    LEFT JOIN genres AS secondary_genre ON secondary_genre.id = stories.secondary_genre_id
    WHERE LOWER(stories.slug) = LOWER(${slug})
      AND stories.status IN ('ongoing', 'completed')
      AND stories.deleted_at IS NULL
      AND users.status = 'active'
      AND users.deleted_at IS NULL
    LIMIT 1
  `

  return story
}

export interface PublicChapter {
  id: string
  chapter_number: string
  title: string
  is_free: boolean
  price: string
  published_at: Date
}

export interface PublicChaptersResult {
  chapters: PublicChapter[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
}

export async function findPublicChaptersBySlug(
  slug: string,
  page: number,
  limit: number,
): Promise<PublicChaptersResult | undefined> {
  const [story] = await db<{ id: string }[]>`
    SELECT stories.id
    FROM stories
    INNER JOIN users ON users.id = stories.creator_user_id
    WHERE LOWER(stories.slug) = LOWER(${slug})
      AND stories.status IN ('ongoing', 'completed')
      AND stories.deleted_at IS NULL
      AND users.status = 'active'
      AND users.deleted_at IS NULL
    LIMIT 1
  `
  if (!story) return undefined

  const offset = (page - 1) * limit
  const [chapters, [count]] = await Promise.all([
    db<PublicChapter[]>`
      SELECT id, chapter_number::TEXT, title, is_free, price::TEXT, published_at
      FROM chapters
      WHERE story_id = ${story.id}
        AND status = 'published'
        AND published_at <= NOW()
      ORDER BY chapter_number DESC, id DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    db<Array<{ total: string }>>`
      SELECT COUNT(*)::TEXT AS total
      FROM chapters
      WHERE story_id = ${story.id}
        AND status = 'published'
        AND published_at <= NOW()
    `,
  ])
  const total = Number(count.total)
  const totalPages = Math.ceil(total / limit)

  return {
    chapters,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
  }
}

export interface PublicContentSitemapEntry {
  slug: string
  cover_url: string | null
  updated_at: Date
}

export async function listPublicContentForSitemap(): Promise<PublicContentSitemapEntry[]> {
  return db<PublicContentSitemapEntry[]>`
    SELECT stories.slug, stories.cover_url, stories.updated_at
    FROM stories
    INNER JOIN users ON users.id = stories.creator_user_id
    WHERE stories.status IN ('ongoing', 'completed')
      AND stories.deleted_at IS NULL
      AND users.status = 'active'
      AND users.deleted_at IS NULL
    ORDER BY stories.updated_at DESC, stories.id DESC
  `
}
