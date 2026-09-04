import { db } from '../../../db'
import type {
  CreatedStory,
  GetMyContentsInput,
  MyContentsResult,
  WriterContent,
  WriterContentCount,
  WriterContentDetail,
} from '../../../models/writer-content.model'
import type { StoryStatus, StoryType } from '../../../models/story.model'

export interface WriterContentRecordInput {
  type: StoryType
  title: string
  slug: string
  synopsis: string | null
  coverUrl: string | null
  coverBlurDataUrl: string | null
  status: StoryStatus
  ageRating: number
  primaryGenreId: string
  secondaryGenreId: string | null
}

export async function findWriterContent(
  creatorUserId: string,
  contentId: string,
): Promise<WriterContentDetail | undefined> {
  const [story] = await db<WriterContentDetail[]>`
    SELECT id, title, slug, synopsis, cover_url, cover_blur_data_url, type, status, age_rating,
      primary_genre_id, secondary_genre_id
    FROM stories
    WHERE id = ${contentId}
      AND creator_user_id = ${creatorUserId}
      AND deleted_at IS NULL
    LIMIT 1
  `
  return story
}

export async function findGenreExistence(
  primaryGenreId: string,
  secondaryGenreId: string | null,
): Promise<{ primary_exists: boolean; secondary_exists: boolean }> {
  const [genres] = await db<{ primary_exists: boolean; secondary_exists: boolean }[]>`
    SELECT
      EXISTS (SELECT 1 FROM genres WHERE id = ${primaryGenreId}) AS primary_exists,
      (
        ${secondaryGenreId}::UUID IS NULL
        OR EXISTS (SELECT 1 FROM genres WHERE id = ${secondaryGenreId})
      ) AS secondary_exists
  `
  return genres
}

export async function getWriterContentsByType(
  creatorUserId: string,
  storyType: StoryType,
  input: Pick<GetMyContentsInput, 'page' | 'limit'>,
): Promise<MyContentsResult> {
  const offset = (input.page - 1) * input.limit
  const [contents, [count]] = await Promise.all([
    db<WriterContent[]>`
      SELECT
        stories.id, stories.title, stories.slug, stories.cover_url,
        stories.cover_blur_data_url, stories.type,
        stories.status, stories.total_views::TEXT,
        COUNT(chapters.id)::TEXT AS chapter_count,
        (
          SELECT COUNT(*)
          FROM chapter_purchases
          INNER JOIN chapters AS purchased_chapters
            ON purchased_chapters.id = chapter_purchases.chapter_id
          WHERE purchased_chapters.story_id = stories.id
        )::TEXT AS sales_count,
        CASE
          WHEN latest_chapter.id IS NULL THEN NULL
          ELSE json_build_object(
            'chapter_number', latest_chapter.chapter_number::TEXT,
            'title', latest_chapter.title,
            'status', latest_chapter.status,
            'published_at', latest_chapter.published_at
          )
        END AS latest_chapter,
        stories.created_at, stories.updated_at
      FROM stories
      LEFT JOIN chapters ON chapters.story_id = stories.id
      LEFT JOIN LATERAL (
        SELECT chapters.id, chapters.chapter_number, chapters.title,
          chapters.status, chapters.published_at
        FROM chapters
        WHERE chapters.story_id = stories.id
        ORDER BY chapters.chapter_number DESC, chapters.id DESC
        LIMIT 1
      ) AS latest_chapter ON TRUE
      WHERE stories.creator_user_id = ${creatorUserId}
        AND stories.type = ${storyType}
        AND stories.deleted_at IS NULL
      GROUP BY stories.id, latest_chapter.id, latest_chapter.chapter_number,
        latest_chapter.title, latest_chapter.status, latest_chapter.published_at
      ORDER BY stories.updated_at DESC, stories.id DESC
      LIMIT ${input.limit}
      OFFSET ${offset}
    `,
    db<WriterContentCount[]>`
      SELECT COUNT(*)::TEXT AS total
      FROM stories
      WHERE creator_user_id = ${creatorUserId}
        AND type = ${storyType}
        AND deleted_at IS NULL
    `,
  ])
  const total = Number(count.total)
  return {
    contents,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  }
}

export async function insertWriterContent(
  creatorUserId: string,
  input: WriterContentRecordInput,
): Promise<CreatedStory> {
  const [story] = await db<CreatedStory[]>`
    INSERT INTO stories (
      creator_user_id, type, title, slug, synopsis, cover_url, cover_blur_data_url, status,
      age_rating, primary_genre_id, secondary_genre_id
    ) VALUES (
      ${creatorUserId}, ${input.type}, ${input.title}, ${input.slug}, ${input.synopsis},
      ${input.coverUrl}, ${input.coverBlurDataUrl}, ${input.status}, ${input.ageRating}, ${input.primaryGenreId},
      ${input.secondaryGenreId}
    )
    RETURNING id, type, slug, cover_url, cover_blur_data_url
  `
  return story
}

export async function updateWriterContentRecord(
  creatorUserId: string,
  contentId: string,
  input: WriterContentRecordInput,
): Promise<CreatedStory | undefined> {
  const [story] = await db<CreatedStory[]>`
    UPDATE stories
    SET type = ${input.type}, title = ${input.title}, slug = ${input.slug},
      synopsis = ${input.synopsis}, cover_url = ${input.coverUrl},
      cover_blur_data_url = ${input.coverBlurDataUrl}, status = ${input.status},
      age_rating = ${input.ageRating}, primary_genre_id = ${input.primaryGenreId},
      secondary_genre_id = ${input.secondaryGenreId}, updated_at = NOW()
    WHERE id = ${contentId}
      AND creator_user_id = ${creatorUserId}
      AND deleted_at IS NULL
    RETURNING id, type, slug, cover_url, cover_blur_data_url
  `
  return story
}
