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
  favorite_count: string
  is_favorited: boolean
  rating_average: string
  rating_count: string
  user_rating: number | null
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
  currentUserId: string | null = null,
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
      (
        SELECT COUNT(*)::TEXT
        FROM story_favorites
        WHERE story_favorites.story_id = stories.id
      ) AS favorite_count,
      EXISTS (
        SELECT 1
        FROM story_favorites
        WHERE story_favorites.story_id = stories.id
          AND story_favorites.user_id = ${currentUserId}::UUID
      ) AS is_favorited,
      COALESCE((
        SELECT ROUND(AVG(story_ratings.rating)::NUMERIC, 1)::TEXT
        FROM story_ratings
        WHERE story_ratings.story_id = stories.id
      ), '0.0') AS rating_average,
      (
        SELECT COUNT(*)::TEXT
        FROM story_ratings
        WHERE story_ratings.story_id = stories.id
      ) AS rating_count,
      (
        SELECT story_ratings.rating::INTEGER
        FROM story_ratings
        WHERE story_ratings.story_id = stories.id
          AND story_ratings.user_id = ${currentUserId}::UUID
      ) AS user_rating,
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

export interface PublicContentFavorite {
  is_favorited: boolean
  favorite_count: number
}

export async function getPublicContentFavoriteBySlug(
  slug: string,
  currentUserId: string | null,
): Promise<PublicContentFavorite | undefined> {
  const [favorite] = await db<PublicContentFavorite[]>`
    SELECT
      EXISTS (
        SELECT 1
        FROM story_favorites
        WHERE story_favorites.story_id = stories.id
          AND story_favorites.user_id = ${currentUserId}::UUID
      ) AS is_favorited,
      (
        SELECT COUNT(*)::INTEGER
        FROM story_favorites
        WHERE story_favorites.story_id = stories.id
      ) AS favorite_count
    FROM stories
    INNER JOIN users ON users.id = stories.creator_user_id
    WHERE LOWER(stories.slug) = LOWER(${slug})
      AND stories.status IN ('ongoing', 'completed')
      AND stories.deleted_at IS NULL
      AND users.status = 'active'
      AND users.deleted_at IS NULL
    LIMIT 1
  `

  return favorite
}

export async function addPublicContentFavorite(
  slug: string,
  currentUserId: string,
): Promise<PublicContentFavorite | undefined> {
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

  await db`
    INSERT INTO story_favorites (user_id, story_id)
    VALUES (${currentUserId}, ${story.id})
    ON CONFLICT (user_id, story_id) DO NOTHING
  `

  return getPublicContentFavoriteBySlug(slug, currentUserId)
}

export async function removePublicContentFavorite(
  slug: string,
  currentUserId: string,
): Promise<PublicContentFavorite | undefined> {
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

  await db`
    DELETE FROM story_favorites
    WHERE user_id = ${currentUserId} AND story_id = ${story.id}
  `

  return getPublicContentFavoriteBySlug(slug, currentUserId)
}

export interface PublicContentRating {
  user_rating: number
  rating_average: number
  rating_count: number
}

export async function ratePublicContentBySlug(
  slug: string,
  currentUserId: string,
  rating: number,
): Promise<PublicContentRating | undefined> {
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

  await db`
    INSERT INTO story_ratings (user_id, story_id, rating)
    VALUES (${currentUserId}, ${story.id}, ${rating})
    ON CONFLICT (user_id, story_id) DO UPDATE SET
      rating = EXCLUDED.rating,
      updated_at = NOW()
  `

  const [result] = await db<PublicContentRating[]>`
    SELECT
      ${rating}::INTEGER AS user_rating,
      ROUND(AVG(story_ratings.rating)::NUMERIC, 1)::REAL AS rating_average,
      COUNT(*)::INTEGER AS rating_count
    FROM story_ratings
    WHERE story_ratings.story_id = ${story.id}
  `

  return result
}

export interface PublicChapter {
  id: string
  chapter_number: string
  title: string
  is_free: boolean
  price: string
  published_at: Date
  is_purchased: boolean
  is_owner: boolean
  can_read: boolean
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

export type PublicChapterSort = 'latest' | 'oldest' | 'chapter_asc' | 'chapter_desc'

export async function findPublicChaptersBySlug(
  slug: string,
  page: number,
  limit: number,
  currentUserId: string | null,
  sort: PublicChapterSort = 'latest',
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
      SELECT
        chapters.id,
        chapters.chapter_number::TEXT,
        chapters.title,
        chapters.is_free,
        chapters.price::TEXT,
        chapters.published_at,
        EXISTS (
          SELECT 1
          FROM chapter_purchases
          WHERE chapter_purchases.chapter_id = chapters.id
            AND chapter_purchases.buyer_user_id = ${currentUserId}::UUID
        ) AS is_purchased,
        COALESCE(stories.creator_user_id = ${currentUserId}::UUID, FALSE) AS is_owner,
        (
          chapters.is_free
          OR COALESCE(stories.creator_user_id = ${currentUserId}::UUID, FALSE)
          OR EXISTS (
            SELECT 1
            FROM chapter_purchases
            WHERE chapter_purchases.chapter_id = chapters.id
              AND chapter_purchases.buyer_user_id = ${currentUserId}::UUID
          )
        ) AS can_read
      FROM chapters
      INNER JOIN stories ON stories.id = chapters.story_id
      WHERE chapters.story_id = ${story.id}
        AND chapters.status = 'published'
        AND chapters.published_at <= NOW()
      ORDER BY
        CASE WHEN ${sort} = 'latest' THEN chapters.published_at END DESC,
        CASE WHEN ${sort} = 'oldest' THEN chapters.published_at END ASC,
        CASE WHEN ${sort} = 'chapter_asc' THEN chapters.chapter_number END ASC,
        CASE WHEN ${sort} = 'chapter_desc' THEN chapters.chapter_number END DESC,
        CASE WHEN ${sort} IN ('latest', 'chapter_desc') THEN chapters.id END DESC,
        CASE WHEN ${sort} IN ('oldest', 'chapter_asc') THEN chapters.id END ASC
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
