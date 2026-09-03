import { db } from '../../db'
import type {
  BulkUpdateChapterPriceInput,
  BulkUpdateChapterStatusInput,
  GetWriterChaptersInput,
  WriterChapter,
  WriterChapterCount,
  WriterChaptersResult,
} from '../../models/writer-chapter.model'

export class WriterChapterError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404,
  ) {
    super(message)
    this.name = 'WriterChapterError'
  }
}

async function assertStoryOwner(creatorUserId: string, storyId: string): Promise<void> {
  const [story] = await db<{ id: string }[]>`
    SELECT id
    FROM stories
    WHERE id = ${storyId}
      AND creator_user_id = ${creatorUserId}
      AND deleted_at IS NULL
    LIMIT 1
  `

  if (!story) throw new WriterChapterError('ไม่พบผลงานที่ต้องการจัดการ', 404)
}

async function assertSelectedChapters(
  creatorUserId: string,
  storyId: string,
  chapterIds: string[],
): Promise<void> {
  const uniqueChapterIds = [...new Set(chapterIds)]
  const chapterIdArray = db.array(uniqueChapterIds, 'UUID')
  const [result] = await db<{ total: string }[]>`
    SELECT COUNT(*)::TEXT AS total
    FROM chapters
    INNER JOIN stories ON stories.id = chapters.story_id
    WHERE chapters.story_id = ${storyId}
      AND chapters.id = ANY(${chapterIdArray})
      AND stories.creator_user_id = ${creatorUserId}
      AND stories.deleted_at IS NULL
  `

  if (Number(result.total) !== uniqueChapterIds.length) {
    throw new WriterChapterError('ไม่พบตอนที่เลือกบางรายการ', 404)
  }
}

export async function getWriterChapters(
  creatorUserId: string,
  storyId: string,
  input: GetWriterChaptersInput,
): Promise<WriterChaptersResult> {
  await assertStoryOwner(creatorUserId, storyId)

  const search = input.search?.trim() ?? ''
  const searchPattern = `%${search}%`
  const offset = (input.page - 1) * input.limit
  const [chapters, [count]] = await Promise.all([
    db<WriterChapter[]>`
      SELECT
        chapters.id,
        chapters.chapter_number::TEXT,
        chapters.title,
        chapters.price::TEXT,
        chapters.is_free,
        COUNT(chapter_purchases.id)::TEXT AS sales_count,
        chapters.status,
        chapters.published_at,
        chapters.created_at
      FROM chapters
      LEFT JOIN chapter_purchases ON chapter_purchases.chapter_id = chapters.id
      WHERE chapters.story_id = ${storyId}
        AND (
          ${search} = ''
          OR chapters.chapter_number::TEXT ILIKE ${searchPattern}
          OR chapters.title ILIKE ${searchPattern}
        )
      GROUP BY chapters.id
      ORDER BY chapters.chapter_number DESC, chapters.id DESC
      LIMIT ${input.limit}
      OFFSET ${offset}
    `,
    db<WriterChapterCount[]>`
      SELECT COUNT(*)::TEXT AS total
      FROM chapters
      WHERE story_id = ${storyId}
        AND (
          ${search} = ''
          OR chapter_number::TEXT ILIKE ${searchPattern}
          OR title ILIKE ${searchPattern}
        )
    `,
  ])

  const total = Number(count.total)
  return {
    chapters,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  }
}

export async function bulkUpdateChapterPrice(
  creatorUserId: string,
  storyId: string,
  input: BulkUpdateChapterPriceInput,
): Promise<number> {
  if (!Number.isFinite(input.price) || input.price < 0) {
    throw new WriterChapterError('ราคาต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป', 400)
  }

  await assertSelectedChapters(creatorUserId, storyId, input.chapter_ids)
  const chapterIdArray = db.array([...new Set(input.chapter_ids)], 'UUID')

  const updatedChapters = await db<{ id: string }[]>`
    UPDATE chapters
    SET
      price = ${input.price},
      is_free = ${input.price === 0},
      updated_at = NOW()
    WHERE story_id = ${storyId}
      AND id = ANY(${chapterIdArray})
    RETURNING id
  `

  return updatedChapters.length
}

export async function bulkUpdateChapterStatus(
  creatorUserId: string,
  storyId: string,
  input: BulkUpdateChapterStatusInput,
): Promise<number> {
  let scheduledAt: Date | null = null
  if (input.status === 'scheduled') {
    scheduledAt = input.published_at ? new Date(input.published_at) : null
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      throw new WriterChapterError('กรุณาระบุเวลาเผยแพร่ในอนาคต', 400)
    }
  }

  await assertSelectedChapters(creatorUserId, storyId, input.chapter_ids)
  const chapterIdArray = db.array([...new Set(input.chapter_ids)], 'UUID')

  const updatedChapters = await db<{ id: string }[]>`
    UPDATE chapters
    SET
      status = ${input.status},
      published_at = CASE
        WHEN ${input.status} = 'scheduled' THEN ${scheduledAt}
        WHEN ${input.status} = 'published' THEN COALESCE(published_at, NOW())
        ELSE published_at
      END,
      updated_at = NOW()
    WHERE story_id = ${storyId}
      AND id = ANY(${chapterIdArray})
    RETURNING id
  `

  return updatedChapters.length
}
