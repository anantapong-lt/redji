import { db } from '../../db'
import { CHAPTER_STATUS, STORY_STATUS, type StoryStatus, type StoryType } from '../../models/story.model'
import { USER_STATUS } from '../../models/user.model'

export interface PublicReaderChapter {
  id: string
  chapter_number: string
  title: string
  is_free: boolean
  price: string
  published_at: Date
  is_purchased: boolean
  can_read: boolean
}

export interface PublicChapterForReading {
  id: string
  chapter_number: string
  title: string
  published_at: Date
  can_read: boolean
  story: {
    id: string
    title: string
    slug: string
    type: StoryType
    cover_url: string | null
  }
}

export interface MangaChapterPageRecord {
  id: string
  page_number: number
  image_key: string
  width: number | null
  height: number | null
  alt_text: string | null
}

export interface MangaChapterPagesResult {
  pages: MangaChapterPageRecord[]
  total: number
}

export async function findPublicChapterForReading(
  slug: string,
  chapterNumber: number,
  currentUserId: string | null,
): Promise<PublicChapterForReading | undefined> {
  const [chapter] = await db<PublicChapterForReading[]>`
    SELECT
      chapters.id,
      chapters.chapter_number::TEXT,
      chapters.title,
      chapters.published_at,
      (
        chapters.is_free
        OR EXISTS (
          SELECT 1
          FROM chapter_purchases
          WHERE chapter_purchases.chapter_id = chapters.id
            AND chapter_purchases.buyer_user_id = ${currentUserId}::UUID
        )
      ) AS can_read,
      json_build_object(
        'id', stories.id,
        'title', stories.title,
        'slug', stories.slug,
        'type', stories.type,
        'cover_url', stories.cover_url
      ) AS story
    FROM chapters
    INNER JOIN stories ON stories.id = chapters.story_id
    INNER JOIN users ON users.id = stories.creator_user_id
    WHERE LOWER(stories.slug) = LOWER(${slug})
      AND chapters.chapter_number = ${chapterNumber}
      AND chapters.status = ${CHAPTER_STATUS.PUBLISHED}
      AND chapters.published_at <= NOW()
      AND stories.status IN (${STORY_STATUS.ONGOING}, ${STORY_STATUS.COMPLETED})
      AND stories.deleted_at IS NULL
      AND users.status = ${USER_STATUS.ACTIVE}
      AND users.deleted_at IS NULL
    LIMIT 1
  `

  return chapter
}

export async function findPublicReaderChapters(
  storyId: string,
  currentUserId: string | null,
): Promise<PublicReaderChapter[]> {
  return db<PublicReaderChapter[]>`
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
      (
        chapters.is_free
        OR EXISTS (
          SELECT 1
          FROM chapter_purchases
          WHERE chapter_purchases.chapter_id = chapters.id
            AND chapter_purchases.buyer_user_id = ${currentUserId}::UUID
        )
      ) AS can_read
    FROM chapters
    WHERE chapters.story_id = ${storyId}
      AND chapters.status = ${CHAPTER_STATUS.PUBLISHED}
      AND chapters.published_at <= NOW()
    ORDER BY chapters.chapter_number ASC, chapters.id ASC
  `
}

export async function findNovelChapterContent(chapterId: string): Promise<string> {
  const [chapter] = await db<Array<{ content: string }>>`
    SELECT content
    FROM novel_chapter_contents
    WHERE chapter_id = ${chapterId}
    LIMIT 1
  `

  return chapter?.content ?? ''
}

export async function findMangaChapterPages(
  chapterId: string,
  page: number,
  limit: number,
): Promise<MangaChapterPagesResult> {
  const offset = (page - 1) * limit
  const [pages, [count]] = await Promise.all([
    db<MangaChapterPageRecord[]>`
      SELECT id, page_number, image_key, width, height, alt_text
      FROM manga_chapter_pages
      WHERE chapter_id = ${chapterId}
      ORDER BY page_number ASC, id ASC
      LIMIT ${limit} OFFSET ${offset}
    `,
    db<Array<{ total: string }>>`
      SELECT COUNT(*)::TEXT AS total
      FROM manga_chapter_pages
      WHERE chapter_id = ${chapterId}
    `,
  ])

  return { pages, total: Number(count.total) }
}

export async function incrementPublicContentView(storyId: string): Promise<void> {
  await db.begin(async (transaction) => {
    await transaction`
      UPDATE stories
      SET total_views = total_views + 1
      WHERE id = ${storyId}
    `

    await transaction`
      INSERT INTO story_daily_views (story_id, view_date, view_count)
      VALUES (
        ${storyId},
        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::DATE,
        1
      )
      ON CONFLICT (story_id, view_date) DO UPDATE SET
        view_count = story_daily_views.view_count + 1
    `
  })
}

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
          AND chapters.status = ${CHAPTER_STATUS.PUBLISHED}
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
          AND chapters.status = ${CHAPTER_STATUS.PUBLISHED}
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
      AND stories.status IN (${STORY_STATUS.ONGOING}, ${STORY_STATUS.COMPLETED})
      AND stories.deleted_at IS NULL
      AND users.status = ${USER_STATUS.ACTIVE}
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
      AND stories.status IN (${STORY_STATUS.ONGOING}, ${STORY_STATUS.COMPLETED})
      AND stories.deleted_at IS NULL
      AND users.status = ${USER_STATUS.ACTIVE}
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
      AND stories.status IN (${STORY_STATUS.ONGOING}, ${STORY_STATUS.COMPLETED})
      AND stories.deleted_at IS NULL
      AND users.status = ${USER_STATUS.ACTIVE}
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
      AND stories.status IN (${STORY_STATUS.ONGOING}, ${STORY_STATUS.COMPLETED})
      AND stories.deleted_at IS NULL
      AND users.status = ${USER_STATUS.ACTIVE}
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
      AND stories.status IN (${STORY_STATUS.ONGOING}, ${STORY_STATUS.COMPLETED})
      AND stories.deleted_at IS NULL
      AND users.status = ${USER_STATUS.ACTIVE}
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
      AND stories.status IN (${STORY_STATUS.ONGOING}, ${STORY_STATUS.COMPLETED})
      AND stories.deleted_at IS NULL
      AND users.status = ${USER_STATUS.ACTIVE}
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
      AND chapters.status = ${CHAPTER_STATUS.PUBLISHED}
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
    WHERE stories.status IN (${STORY_STATUS.ONGOING}, ${STORY_STATUS.COMPLETED})
      AND stories.deleted_at IS NULL
      AND users.status = ${USER_STATUS.ACTIVE}
      AND users.deleted_at IS NULL
    ORDER BY stories.updated_at DESC, stories.id DESC
  `
}
