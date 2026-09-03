import { db } from '../../db'
import type {
  CreatedStory,
  CreateWriterContentInput,
  GetMyContentsInput,
  MyContentsResult,
  WriterContent,
  WriterContentCount,
} from '../../models/writer-content.model'
import type { StoryType } from '../../models/story.model'
import { deleteWriterCover, uploadWriterCover } from './writer-cover.service'

export class CreateWriterContentError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 409,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'CreateWriterContentError'
  }
}

function optionalText(value?: string): string | null {
  const trimmedValue = value?.trim()
  return trimmedValue ? trimmedValue : null
}

function parseAgeRating(value?: string): number | null {
  const trimmedValue = value?.trim()
  if (!trimmedValue) return null

  const ageRating = Number(trimmedValue)
  if (!Number.isInteger(ageRating) || ageRating < 0 || ageRating > 32_767) {
    throw new CreateWriterContentError(
      'เรทอายุต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 32767',
      400,
      'age_rating',
    )
  }

  return ageRating
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && error.code === '23505',
  )
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
