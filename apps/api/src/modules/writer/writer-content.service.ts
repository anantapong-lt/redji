import { db } from '../../db'
import type {
  CreatedStory,
  CreateWriterContentInput,
  GetMyContentsInput,
  MyContentsResult,
  UpdateWriterContentInput,
  WriterContent,
  WriterContentCount,
  WriterContentDetail,
} from '../../models/writer-content.model'
import type { StoryType } from '../../models/story.model'
import {
  deleteWriterCover,
  deleteWriterCoverByUrl,
  uploadWriterCover,
} from './writer-cover.service'

export class CreateWriterContentError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'CreateWriterContentError'
  }
}

export async function getWriterContent(
  creatorUserId: string,
  contentId: string,
): Promise<WriterContentDetail> {
  const [story] = await db<WriterContentDetail[]>`
    SELECT
      id,
      title,
      slug,
      synopsis,
      cover_url,
      type,
      status,
      age_rating,
      primary_genre_id,
      secondary_genre_id
    FROM stories
    WHERE id = ${contentId}
      AND creator_user_id = ${creatorUserId}
      AND deleted_at IS NULL
    LIMIT 1
  `

  if (!story) {
    throw new CreateWriterContentError('ไม่พบเนื้อหาที่ต้องการแก้ไข', 404)
  }

  return story
}

function optionalText(value?: string): string | null {
  const trimmedValue = value?.trim()
  return trimmedValue ? trimmedValue : null
}

function parseAgeRating(value: string): number {
  const trimmedValue = value.trim()

  const ageRating = Number(trimmedValue)
  if (ageRating !== 0 && ageRating !== 18) {
    throw new CreateWriterContentError(
      'กรุณาเลือกระดับเนื้อหา',
      400,
      'age_rating',
    )
  }

  return ageRating
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const postgresError = error as Record<string, unknown>
  return postgresError.code === '23505' || postgresError.errno === '23505'
}

const RANDOM_SLUG_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789'
const RANDOM_SLUG_LENGTH = 15

function createRandomSlug(): string {
  const randomValues = crypto.getRandomValues(new Uint8Array(RANDOM_SLUG_LENGTH))
  return Array.from(
    randomValues,
    (value) => RANDOM_SLUG_CHARACTERS[value % RANDOM_SLUG_CHARACTERS.length],
  ).join('')
}

export async function getMyContents(
  creatorUserId: string,
  input: GetMyContentsInput,
): Promise<MyContentsResult> {
  const storyType: StoryType = input.tab === 'cartoon' ? 'manga' : 'novel'
  const offset = (input.page - 1) * input.limit

  const [contents, [count]] = await Promise.all([
    db<WriterContent[]>`
      SELECT
        stories.id,
        stories.title,
        stories.slug,
        stories.cover_url,
        stories.type,
        stories.status,
        stories.total_views::TEXT,
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
        stories.created_at,
        stories.updated_at
      FROM stories
      LEFT JOIN chapters ON chapters.story_id = stories.id
      LEFT JOIN LATERAL (
        SELECT
          chapters.id,
          chapters.chapter_number,
          chapters.title,
          chapters.status,
          chapters.published_at
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

export async function createWriterContent(
  creatorUserId: string,
  input: CreateWriterContentInput,
): Promise<CreatedStory> {
  const title = input.title.trim()
  const shouldGenerateSlug = input.auto_generate_slug === 'true'
  const submittedSlug = input.slug?.trim() ?? ''
  const slug = shouldGenerateSlug ? createRandomSlug() : submittedSlug
  const synopsis = optionalText(input.synopsis)
  const secondaryGenreId = optionalText(input.secondary_genre_id)
  const ageRating = parseAgeRating(input.age_rating)

  if (!title) throw new CreateWriterContentError('กรุณากรอกชื่อเรื่อง', 400, 'title')
  if (!shouldGenerateSlug && !slug) {
    throw new CreateWriterContentError('กรุณากรอกลิงก์ URL', 400, 'slug')
  }

  if (secondaryGenreId === input.primary_genre_id) {
    throw new CreateWriterContentError(
      'หมวดหมู่หลักและหมวดหมู่รองต้องไม่ซ้ำกัน',
      400,
      'secondary_genre_id',
    )
  }

  const [genres] = await db<{
    primary_exists: boolean
    secondary_exists: boolean
  }[]>`
    SELECT
      EXISTS (
        SELECT 1 FROM genres WHERE id = ${input.primary_genre_id}
      ) AS primary_exists,
      (
        ${secondaryGenreId}::UUID IS NULL
        OR EXISTS (
          SELECT 1 FROM genres WHERE id = ${secondaryGenreId}
        )
      ) AS secondary_exists
  `

  if (!genres.primary_exists) {
    throw new CreateWriterContentError('ไม่พบหมวดหมู่หลักที่เลือก', 400, 'primary_genre_id')
  }

  if (!genres.secondary_exists) {
    throw new CreateWriterContentError('ไม่พบหมวดหมู่รองที่เลือก', 400, 'secondary_genre_id')
  }

  const uploadedCover = input.cover ? await uploadWriterCover(input.cover) : null

  try {
    const [story] = await db<CreatedStory[]>`
      INSERT INTO stories (
        creator_user_id,
        type,
        title,
        slug,
        synopsis,
        cover_url,
        status,
        age_rating,
        primary_genre_id,
        secondary_genre_id
      ) VALUES (
        ${creatorUserId},
        ${input.type},
        ${title},
        ${slug},
        ${synopsis},
        ${uploadedCover?.cover_url ?? null},
        ${input.status},
        ${ageRating},
        ${input.primary_genre_id},
        ${secondaryGenreId}
      )
      RETURNING id, type, slug, cover_url
    `

    return story
  } catch (error) {
    if (uploadedCover) {
      try {
        await deleteWriterCover(uploadedCover.key)
      } catch (deleteError) {
        console.error('Unable to remove orphaned writer cover', deleteError)
      }
    }

    if (isUniqueViolation(error)) {
      throw new CreateWriterContentError('ลิงก์ URL นี้ถูกใช้งานแล้ว', 409, 'slug')
    }

    throw error
  }
}

export async function updateWriterContent(
  creatorUserId: string,
  contentId: string,
  input: UpdateWriterContentInput,
): Promise<CreatedStory> {
  const existingStory = await getWriterContent(creatorUserId, contentId)
  const title = input.title.trim()
  const slug = input.slug.trim()
  const synopsis = optionalText(input.synopsis)
  const secondaryGenreId = optionalText(input.secondary_genre_id)
  const ageRating = parseAgeRating(input.age_rating)

  if (!title) throw new CreateWriterContentError('กรุณากรอกชื่อเรื่อง', 400, 'title')
  if (!slug) throw new CreateWriterContentError('กรุณากรอกลิงก์ URL', 400, 'slug')

  if (secondaryGenreId === input.primary_genre_id) {
    throw new CreateWriterContentError(
      'หมวดหมู่หลักและหมวดหมู่รองต้องไม่ซ้ำกัน',
      400,
      'secondary_genre_id',
    )
  }

  const [genres] = await db<{
    primary_exists: boolean
    secondary_exists: boolean
  }[]>`
    SELECT
      EXISTS (
        SELECT 1 FROM genres WHERE id = ${input.primary_genre_id}
      ) AS primary_exists,
      (
        ${secondaryGenreId}::UUID IS NULL
        OR EXISTS (
          SELECT 1 FROM genres WHERE id = ${secondaryGenreId}
        )
      ) AS secondary_exists
  `

  if (!genres.primary_exists) {
    throw new CreateWriterContentError('ไม่พบหมวดหมู่หลักที่เลือก', 400, 'primary_genre_id')
  }

  if (!genres.secondary_exists) {
    throw new CreateWriterContentError('ไม่พบหมวดหมู่รองที่เลือก', 400, 'secondary_genre_id')
  }

  const uploadedCover = input.cover ? await uploadWriterCover(input.cover) : null
  const shouldRemoveCover = input.remove_cover === 'true'
  const previousCoverUrl = existingStory.cover_url
  const hasCoverChanged = Boolean(uploadedCover) || shouldRemoveCover
  const nextCoverUrl = uploadedCover?.cover_url
    ?? (shouldRemoveCover ? null : previousCoverUrl)

  try {
    const [story] = await db<CreatedStory[]>`
      UPDATE stories
      SET
        type = ${input.type},
        title = ${title},
        slug = ${slug},
        synopsis = ${synopsis},
        cover_url = ${nextCoverUrl},
        status = ${input.status},
        age_rating = ${ageRating},
        primary_genre_id = ${input.primary_genre_id},
        secondary_genre_id = ${secondaryGenreId},
        updated_at = NOW()
      WHERE id = ${contentId}
        AND creator_user_id = ${creatorUserId}
        AND deleted_at IS NULL
      RETURNING id, type, slug, cover_url
    `

    if (!story) {
      throw new CreateWriterContentError('ไม่พบเนื้อหาที่ต้องการแก้ไข', 404)
    }

    // Keep the previous object until the database points to the new cover.
    if (previousCoverUrl && hasCoverChanged) {
      try {
        await deleteWriterCoverByUrl(previousCoverUrl)
      } catch (deleteError) {
        console.error('Unable to remove replaced writer cover', deleteError)
      }
    }

    return story
  } catch (error) {
    if (uploadedCover) {
      try {
        await deleteWriterCover(uploadedCover.key)
      } catch (deleteError) {
        console.error('Unable to remove orphaned writer cover', deleteError)
      }
    }

    if (isUniqueViolation(error)) {
      throw new CreateWriterContentError('ลิงก์ URL นี้ถูกใช้งานแล้ว', 409, 'slug')
    }

    throw error
  }
}
