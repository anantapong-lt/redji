import { status } from 'elysia'
import {
  bulkUpdateChapterPrice,
  bulkUpdateChapterStatus,
  createWriterChapter,
  getWriterChapter,
  getWriterChapters,
  updateWriterChapter,
  WriterChapterError,
} from './chapter/writer-chapter.controller'
import {
  createWriterContent,
  CreateWriterContentError,
  getMyContents,
  getWriterContent,
  updateWriterContent,
} from './content/writer-content.controller'
import { getWriterDashboardActivity, getWriterDashboardTopStories, getWriterStats, type WriterDashboardPeriod } from './writer.service'
import type {
  writerContentsQuerySchema,
  createWriterContentBodySchema,
  updateWriterContentBodySchema,
} from './content/writer-content.schema'
import type {
  createWriterChapterBodySchema,
  updateWriterChapterBodySchema,
  writerChaptersQuerySchema,
  bulkUpdateChapterPriceBodySchema,
  bulkUpdateChapterStatusBodySchema,
} from './chapter/writer-chapter.schema'

export async function getWriterStatsResponse(
  userId: string,
  period: WriterDashboardPeriod = 'today',
) {
  const [stats, activity, topStories] = await Promise.all([
    getWriterStats(userId),
    getWriterDashboardActivity(userId, period),
    getWriterDashboardTopStories(userId, period),
  ])
  return { stats, period, activity, top_stories: topStories }
}

export async function getWriterContentsResponse(
  userId: string,
  query: typeof writerContentsQuerySchema.static,
) {
  return getMyContents(userId, {
    tab: query.tab,
    page: query.page ?? 1,
    limit: query.limit ?? 10,
  })
}

export async function createWriterContentResponse(
  userId: string,
  body: typeof createWriterContentBodySchema.static,
) {
  try {
    const story = await createWriterContent(userId, body)
    return status(201, { story })
  } catch (error) {
    if (error instanceof CreateWriterContentError) {
      return status(error.statusCode, {
        message: error.message,
        field: error.field,
      })
    }

    console.error('Unable to create writer content', error)
    return status(500, { message: 'ไม่สามารถสร้างเนื้อหาได้ กรุณาลองใหม่อีกครั้ง' })
  }
}

export async function getWriterContentResponse(
  userId: string,
  contentId: string,
) {
  try {
    return { story: await getWriterContent(userId, contentId) }
  } catch (error) {
    if (error instanceof CreateWriterContentError) {
      return status(error.statusCode, {
        message: error.message,
        field: error.field,
      })
    }

    console.error('Unable to load writer content', error)
    return status(500, { message: 'ไม่สามารถโหลดเนื้อหาได้ กรุณาลองใหม่อีกครั้ง' })
  }
}

export async function createWriterChapterResponse(
  userId: string,
  contentId: string,
  body: typeof createWriterChapterBodySchema.static,
) {
  try {
    const chapter = await createWriterChapter(userId, contentId, body)
    return status(201, { chapter })
  } catch (error) {
    if (error instanceof WriterChapterError) {
      return status(error.statusCode, { message: error.message, field: error.field })
    }

    console.error('Unable to create writer chapter', error)
    return status(500, { message: 'ไม่สามารถสร้างตอนได้ กรุณาลองใหม่อีกครั้ง' })
  }
}

export async function getWriterChapterResponse(
  userId: string,
  contentId: string,
  chapterId: string,
) {
  try {
    return Response.json(
      { chapter: await getWriterChapter(userId, contentId, chapterId) },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (error instanceof WriterChapterError) {
      return status(error.statusCode, { message: error.message, field: error.field })
    }

    console.error('Unable to load writer chapter', error)
    return status(500, { message: 'ไม่สามารถโหลดข้อมูลตอนได้ กรุณาลองใหม่อีกครั้ง' })
  }
}

export async function updateWriterChapterResponse(
  userId: string,
  contentId: string,
  chapterId: string,
  body: typeof updateWriterChapterBodySchema.static,
) {
  try {
    const chapter = await updateWriterChapter(
      userId,
      contentId,
      chapterId,
      body,
    )
    return { chapter }
  } catch (error) {
    if (error instanceof WriterChapterError) {
      return status(error.statusCode, { message: error.message, field: error.field })
    }

    console.error('Unable to update writer chapter', error)
    return status(500, { message: 'ไม่สามารถแก้ไขตอนได้ กรุณาลองใหม่อีกครั้ง' })
  }
}

export async function updateWriterContentResponse(
  userId: string,
  contentId: string,
  body: typeof updateWriterContentBodySchema.static,
) {
  try {
    const story = await updateWriterContent(userId, contentId, body)
    return { story }
  } catch (error) {
    if (error instanceof CreateWriterContentError) {
      return status(error.statusCode, {
        message: error.message,
        field: error.field,
      })
    }

    console.error('Unable to update writer content', error)
    return status(500, { message: 'ไม่สามารถแก้ไขเนื้อหาได้ กรุณาลองใหม่อีกครั้ง' })
  }
}

export async function getWriterChaptersResponse(
  userId: string,
  contentId: string,
  query: typeof writerChaptersQuerySchema.static,
) {
  try {
    return await getWriterChapters(userId, contentId, {
      search: query.search,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    })
  } catch (error) {
    if (error instanceof WriterChapterError) {
      return status(error.statusCode, { message: error.message })
    }

    console.error('Unable to load writer chapters', error)
    return status(500, { message: 'ไม่สามารถโหลดรายการตอนได้ กรุณาลองใหม่อีกครั้ง' })
  }
}

export async function bulkUpdateChapterPriceResponse(
  userId: string,
  contentId: string,
  body: typeof bulkUpdateChapterPriceBodySchema.static,
) {
  try {
    const updatedCount = await bulkUpdateChapterPrice(userId, contentId, body)
    return { updated_count: updatedCount }
  } catch (error) {
    if (error instanceof WriterChapterError) {
      return status(error.statusCode, { message: error.message })
    }

    console.error('Unable to bulk update chapter price', error)
    return status(500, { message: 'ไม่สามารถอัปเดตราคาตอนได้ กรุณาลองใหม่อีกครั้ง' })
  }
}

export async function bulkUpdateChapterStatusResponse(
  userId: string,
  contentId: string,
  body: typeof bulkUpdateChapterStatusBodySchema.static,
) {
  try {
    const updatedCount = await bulkUpdateChapterStatus(userId, contentId, body)
    return { updated_count: updatedCount }
  } catch (error) {
    if (error instanceof WriterChapterError) {
      return status(error.statusCode, { message: error.message })
    }

    console.error('Unable to bulk update chapter status', error)
    return status(500, { message: 'ไม่สามารถอัปเดตสถานะตอนได้ กรุณาลองใหม่อีกครั้ง' })
  }
}
