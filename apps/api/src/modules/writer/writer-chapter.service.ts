import { db } from '../../db'
import type {
  BulkUpdateChapterPriceInput,
  BulkUpdateChapterStatusInput,
  CreatedWriterChapter,
  CreateWriterChapterInput,
  GetWriterChaptersInput,
  WriterChapter,
  WriterChapterCount,
  WriterChaptersResult,
} from '../../models/writer-chapter.model'
import { CHAPTER_STATUS, STORY_TYPE, type StoryType } from '../../models/story.model'
import {
  deleteWriterChapterPage,
  uploadWriterChapterPage,
  type UploadedChapterPage,
} from './writer-chapter-page.service'

export class WriterChapterError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'WriterChapterError'
  }
}

async function assertStoryOwner(creatorUserId: string, storyId: string): Promise<StoryType> {
  const [story] = await db<{ type: StoryType }[]>`
    SELECT type
    FROM stories
    WHERE id = ${storyId}
      AND creator_user_id = ${creatorUserId}
      AND deleted_at IS NULL
    LIMIT 1
  `

  if (!story) throw new WriterChapterError('ไม่พบผลงานที่ต้องการจัดการ', 404)
  return story.type
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const postgresError = error as Record<string, unknown>
  return postgresError.code === '23505' || postgresError.errno === '23505'
}

function plainTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|ensp|emsp|thinsp|#160|#xA0);/gi, ' ')
    .replace(/&[a-zA-Z0-9#]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function countWords(text: string): number {
  return Array.from(
    new Intl.Segmenter('th', { granularity: 'word' }).segment(text),
  ).filter((part) => part.isWordLike).length
}

export async function createWriterChapter(
  creatorUserId: string,
  storyId: string,
  input: CreateWriterChapterInput,
): Promise<CreatedWriterChapter> {
  const storyType = await assertStoryOwner(creatorUserId, storyId)
  const title = input.title.trim()
  const chapterNumber = Number(input.chapter_number)
  const price = Number(input.price)
  const content = input.content?.trim() ?? ''
  const images = input.images ?? []

  if (!title) throw new WriterChapterError('กรุณากรอกชื่อตอน', 400, 'title')
  if (!Number.isFinite(chapterNumber) || chapterNumber < 0 || chapterNumber > 99_999_999.99) {
    throw new WriterChapterError('เลขตอนต้องเป็นตัวเลขตั้งแต่ 0 ถึง 99,999,999.99', 400, 'chapter_number')
  }
  if (!Number.isFinite(price) || price < 0 || price > 9_999_999_999.99) {
    throw new WriterChapterError('ราคาต้องเป็นตัวเลขตั้งแต่ 0 ถึง 9,999,999,999.99', 400, 'price')
  }

  let publishedAt: Date | null = null
  if (input.status === CHAPTER_STATUS.SCHEDULED) {
    publishedAt = input.published_at ? new Date(input.published_at) : null
    if (!publishedAt || Number.isNaN(publishedAt.getTime()) || publishedAt <= new Date()) {
      throw new WriterChapterError('กรุณาระบุเวลาเผยแพร่ในอนาคต', 400, 'published_at')
    }
  } else if (input.status === CHAPTER_STATUS.PUBLISHED) {
    publishedAt = new Date()
  }

  const plainContent = plainTextFromHtml(content)
  if (storyType === STORY_TYPE.NOVEL && !plainContent) {
    throw new WriterChapterError('กรุณากรอกเนื้อหาตอน', 400, 'content')
  }
  if (storyType === STORY_TYPE.MANGA && images.length === 0) {
    throw new WriterChapterError('กรุณาเพิ่มรูปภาพอย่างน้อย 1 รูป', 400, 'images')
  }

  const uploadedPages: UploadedChapterPage[] = []

  try {
    if (storyType === STORY_TYPE.MANGA) {
      for (const image of images) {
        uploadedPages.push(await uploadWriterChapterPage(image))
      }
    }

    return await db.begin(async (transaction) => {
      const [chapter] = await transaction<Omit<CreatedWriterChapter, 'story_type'>[]>`
        INSERT INTO chapters (
          story_id, chapter_number, title, price, is_free, status, published_at
        ) VALUES (
          ${storyId}, ${chapterNumber}, ${title}, ${price}, ${price === 0},
          ${input.status}, ${publishedAt}
        )
        RETURNING id, story_id, chapter_number::TEXT, title, price::TEXT,
          is_free, status, published_at, created_at
      `

      if (storyType === STORY_TYPE.NOVEL) {
        await transaction`
          INSERT INTO novel_chapter_contents (chapter_id, content, word_count)
          VALUES (${chapter.id}, ${content}, ${countWords(plainContent)})
        `
      } else {
        for (const [index, page] of uploadedPages.entries()) {
          await transaction`
            INSERT INTO manga_chapter_pages (
              chapter_id, page_number, image_url, width, height, alt_text
            ) VALUES (
              ${chapter.id}, ${index + 1}, ${page.image_url}, ${page.width}, ${page.height},
              ${`หน้า ${index + 1}: ${title}`}
            )
          `
        }
      }

      await transaction`
        UPDATE stories SET updated_at = NOW() WHERE id = ${storyId}
      `

      return { ...chapter, story_type: storyType }
    })
  } catch (error) {
    const cleanupResults = await Promise.allSettled(uploadedPages.map(async (page) => {
      await deleteWriterChapterPage(page.key)
    }))
    for (const cleanupResult of cleanupResults) {
      if (cleanupResult.status === 'rejected') {
        console.error('Unable to remove orphaned writer chapter page', cleanupResult.reason)
      }
    }

    if (isUniqueViolation(error)) {
      throw new WriterChapterError('เลขตอนนี้ถูกใช้งานแล้ว', 409, 'chapter_number')
    }
    throw error
  }
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
  if (input.status === CHAPTER_STATUS.SCHEDULED) {
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
        WHEN ${input.status} = ${CHAPTER_STATUS.SCHEDULED} THEN ${scheduledAt}
        WHEN ${input.status} = ${CHAPTER_STATUS.PUBLISHED} THEN COALESCE(published_at, NOW())
        ELSE published_at
      END,
      updated_at = NOW()
    WHERE story_id = ${storyId}
      AND id = ANY(${chapterIdArray})
    RETURNING id
  `

  return updatedChapters.length
}
