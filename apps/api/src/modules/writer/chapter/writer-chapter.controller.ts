import type {
  BulkUpdateChapterPriceInput,
  BulkUpdateChapterStatusInput,
  CreatedWriterChapter,
  CreateWriterChapterInput,
  GetWriterChaptersInput,
  UpdateWriterChapterInput,
  WriterChapterDetail,
  WriterChaptersResult,
} from '../../../models/writer-chapter.model'
import { CHAPTER_STATUS, STORY_TYPE, type StoryType } from '../../../models/story.model'
import {
  deleteWriterChapterPage,
  deleteWriterChapterPageByUrl,
  uploadWriterChapterPage,
  type UploadedChapterPage,
} from './writer-chapter-page.service'
import {
  countOwnedChapters,
  findOwnedStoryType,
  findWriterChapter,
  insertWriterChapter,
  queryWriterChapters,
  updateChapterPrices,
  updateChapterStatuses,
  updateWriterChapterRecord,
  type ChapterWriteInput,
} from './writer-chapter.service'

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

async function requireOwnedStoryType(creatorUserId: string, storyId: string) {
  const storyType = await findOwnedStoryType(creatorUserId, storyId)
  if (!storyType) throw new WriterChapterError('ไม่พบผลงานที่ต้องการจัดการ', 404)
  return storyType
}

function normalizeChapterInput(
  storyType: StoryType,
  input: CreateWriterChapterInput,
  existingPublishedAt?: Date | null,
): ChapterWriteInput {
  const title = input.title.trim()
  const chapterNumber = Number(input.chapter_number)
  const price = Number(input.price)
  const content = input.content?.trim() ?? ''

  if (!title) throw new WriterChapterError('กรุณากรอกชื่อตอน', 400, 'title')
  if (!Number.isFinite(chapterNumber) || chapterNumber < 0 || chapterNumber > 99_999_999.99) {
    throw new WriterChapterError('เลขตอนต้องเป็นตัวเลขตั้งแต่ 0 ถึง 99,999,999.99', 400, 'chapter_number')
  }
  if (!Number.isFinite(price) || price < 0 || price > 9_999_999_999.99) {
    throw new WriterChapterError('ราคาต้องเป็นตัวเลขตั้งแต่ 0 ถึง 9,999,999,999.99', 400, 'price')
  }

  let publishedAt = existingPublishedAt ?? null
  if (input.status === CHAPTER_STATUS.SCHEDULED) {
    publishedAt = input.published_at ? new Date(input.published_at) : null
    if (!publishedAt || Number.isNaN(publishedAt.getTime()) || publishedAt <= new Date()) {
      throw new WriterChapterError('กรุณาระบุเวลาเผยแพร่ในอนาคต', 400, 'published_at')
    }
  } else if (input.status === CHAPTER_STATUS.PUBLISHED && !publishedAt) {
    publishedAt = new Date()
  }

  const plainContent = plainTextFromHtml(content)
  if (storyType === STORY_TYPE.NOVEL && !plainContent) {
    throw new WriterChapterError('กรุณากรอกเนื้อหาตอน', 400, 'content')
  }

  return {
    title,
    chapterNumber,
    price,
    status: input.status,
    publishedAt,
    content,
    wordCount: countWords(plainContent),
  }
}

function parseRetainedPageIds(value?: string): string[] {
  if (!value) return []
  try {
    const ids: unknown = JSON.parse(value)
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
      throw new Error('Invalid page IDs')
    }
    return [...new Set(ids)]
  } catch {
    throw new WriterChapterError('ข้อมูลรูปภาพเดิมไม่ถูกต้อง', 400, 'images')
  }
}

async function cleanupUploadedPages(pages: UploadedChapterPage[]) {
  const results = await Promise.allSettled(
    pages.map((page) => deleteWriterChapterPage(page.key)),
  )
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Unable to remove orphaned writer chapter page', result.reason)
    }
  }
}

export async function getWriterChapter(
  creatorUserId: string,
  storyId: string,
  chapterId: string,
): Promise<WriterChapterDetail> {
  const storyType = await requireOwnedStoryType(creatorUserId, storyId)
  const chapter = await findWriterChapter(storyId, chapterId, storyType)
  if (!chapter) throw new WriterChapterError('ไม่พบตอนที่ต้องการแก้ไข', 404)
  return chapter
}

export async function getWriterChapters(
  creatorUserId: string,
  storyId: string,
  input: GetWriterChaptersInput,
): Promise<WriterChaptersResult> {
  await requireOwnedStoryType(creatorUserId, storyId)
  return queryWriterChapters(storyId, input)
}

export async function createWriterChapter(
  creatorUserId: string,
  storyId: string,
  input: CreateWriterChapterInput,
): Promise<CreatedWriterChapter> {
  const storyType = await requireOwnedStoryType(creatorUserId, storyId)
  const writeInput = normalizeChapterInput(storyType, input)
  const images = input.images ?? []
  if (storyType === STORY_TYPE.MANGA && images.length === 0) {
    throw new WriterChapterError('กรุณาเพิ่มรูปภาพอย่างน้อย 1 รูป', 400, 'images')
  }

  const uploadedPages: UploadedChapterPage[] = []
  try {
    for (const image of images) {
      uploadedPages.push(
        await uploadWriterChapterPage(image, storyId, writeInput.chapterNumber),
      )
    }
    return await insertWriterChapter(storyId, storyType, writeInput, uploadedPages)
  } catch (error) {
    await cleanupUploadedPages(uploadedPages)
    if (isUniqueViolation(error)) {
      throw new WriterChapterError('เลขตอนนี้ถูกใช้งานแล้ว', 409, 'chapter_number')
    }
    throw error
  }
}

export async function updateWriterChapter(
  creatorUserId: string,
  storyId: string,
  chapterId: string,
  input: UpdateWriterChapterInput,
): Promise<CreatedWriterChapter> {
  const existing = await getWriterChapter(creatorUserId, storyId, chapterId)
  const writeInput = normalizeChapterInput(existing.story_type, input, existing.published_at)
  const images = input.images ?? []
  const retainedPageIds = existing.story_type === STORY_TYPE.MANGA
    ? parseRetainedPageIds(input.retained_page_ids)
    : []
  const existingPageIds = new Set(existing.pages.map((page) => page.id))
  if (retainedPageIds.some((id) => !existingPageIds.has(id))) {
    throw new WriterChapterError('ไม่พบรูปภาพเดิมบางรายการ', 400, 'images')
  }
  if (existing.story_type === STORY_TYPE.MANGA && retainedPageIds.length + images.length === 0) {
    throw new WriterChapterError('กรุณาเพิ่มรูปภาพอย่างน้อย 1 รูป', 400, 'images')
  }
  if (retainedPageIds.length + images.length > 100) {
    throw new WriterChapterError('รูปภาพต้องไม่เกิน 100 รูป', 400, 'images')
  }

  const removedPages = existing.pages.filter((page) => !retainedPageIds.includes(page.id))
  const uploadedPages: UploadedChapterPage[] = []
  try {
    for (const image of images) {
      uploadedPages.push(
        await uploadWriterChapterPage(image, storyId, writeInput.chapterNumber),
      )
    }
    const chapter = await updateWriterChapterRecord(
      storyId,
      chapterId,
      existing.story_type,
      writeInput,
      retainedPageIds,
      removedPages.map((page) => page.id),
      uploadedPages,
    )

    const deletionResults = await Promise.allSettled(
      removedPages.map((page) => deleteWriterChapterPageByUrl(page.image_url)),
    )
    for (const result of deletionResults) {
      if (result.status === 'rejected') {
        console.error('Unable to remove deleted writer chapter page', result.reason)
      }
    }
    return chapter
  } catch (error) {
    await cleanupUploadedPages(uploadedPages)
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
) {
  const uniqueIds = [...new Set(chapterIds)]
  const count = await countOwnedChapters(creatorUserId, storyId, uniqueIds)
  if (count !== uniqueIds.length) {
    throw new WriterChapterError('ไม่พบตอนที่เลือกบางรายการ', 404)
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
  return updateChapterPrices(storyId, input.chapter_ids, input.price)
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
  return updateChapterStatuses(storyId, input.chapter_ids, input.status, scheduledAt)
}
