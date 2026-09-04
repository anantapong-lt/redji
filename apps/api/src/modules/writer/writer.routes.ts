import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import {
  bulkUpdateChapterPrice,
  bulkUpdateChapterStatus,
  createWriterChapter,
  getWriterChapters,
  WriterChapterError,
} from './writer-chapter.service'
import {
  createWriterContent,
  CreateWriterContentError,
  getMyContents,
  getWriterContent,
  updateWriterContent,
} from './writer-content.service'
import {
  bulkUpdateChapterPriceBodySchema,
  bulkUpdateChapterStatusBodySchema,
  createWriterChapterBodySchema,
  createWriterContentBodySchema,
  updateWriterContentBodySchema,
  writerChaptersQuerySchema,
  writerContentParamsSchema,
  writerContentsQuerySchema,
} from './writer.schema'
import { getWriterStats } from './writer.service'

export const writerRoutes = new Elysia({ prefix: '/writer' })
  .use(authMiddleware)
  .get(
    '/stats',
    async ({ currentUser }) => ({ stats: await getWriterStats(currentUser.id) }),
    { auth: USER_ROLE.WRITER },
  )
  .get(
    '/contents',
    async ({ currentUser, query }) => getMyContents(currentUser.id, {
      tab: query.tab,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    }),
    {
      auth: USER_ROLE.WRITER,
      query: writerContentsQuerySchema,
    },
  )
  .post(
    '/contents',
    async ({ body, currentUser, status }) => {
      try {
        const story = await createWriterContent(currentUser.id, body)
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
    },
    {
      auth: USER_ROLE.WRITER,
      body: createWriterContentBodySchema,
    },
  )
  .get(
    '/contents/:id',
    async ({ currentUser, params, status }) => {
      try {
        return { story: await getWriterContent(currentUser.id, params.id) }
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
    },
    {
      auth: USER_ROLE.WRITER,
      params: writerContentParamsSchema,
    },
  )
  .post(
    '/contents/:id/chapters',
    async ({ body, currentUser, params, status }) => {
      try {
        const chapter = await createWriterChapter(currentUser.id, params.id, body)
        return status(201, { chapter })
      } catch (error) {
        if (error instanceof WriterChapterError) {
          return status(error.statusCode, { message: error.message, field: error.field })
        }

        console.error('Unable to create writer chapter', error)
        return status(500, { message: 'ไม่สามารถสร้างตอนได้ กรุณาลองใหม่อีกครั้ง' })
      }
    },
    {
      auth: USER_ROLE.WRITER,
      params: writerContentParamsSchema,
      body: createWriterChapterBodySchema,
    },
  )
  .patch(
    '/contents/:id',
    async ({ body, currentUser, params, status }) => {
      try {
        const story = await updateWriterContent(currentUser.id, params.id, body)
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
    },
    {
      auth: USER_ROLE.WRITER,
      params: writerContentParamsSchema,
      body: updateWriterContentBodySchema,
    },
  )
  .get(
    '/contents/:id/chapters',
    async ({ currentUser, params, query, status }) => {
      try {
        return await getWriterChapters(currentUser.id, params.id, {
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
    },
    {
      auth: USER_ROLE.WRITER,
      params: writerContentParamsSchema,
      query: writerChaptersQuerySchema,
    },
  )
  .patch(
    '/contents/:id/chapters/bulk-price',
    async ({ body, currentUser, params, status }) => {
      try {
        const updatedCount = await bulkUpdateChapterPrice(currentUser.id, params.id, body)
        return { updated_count: updatedCount }
      } catch (error) {
        if (error instanceof WriterChapterError) {
          return status(error.statusCode, { message: error.message })
        }

        console.error('Unable to bulk update chapter price', error)
        return status(500, { message: 'ไม่สามารถอัปเดตราคาตอนได้ กรุณาลองใหม่อีกครั้ง' })
      }
    },
    {
      auth: USER_ROLE.WRITER,
      params: writerContentParamsSchema,
      body: bulkUpdateChapterPriceBodySchema,
    },
  )
  .patch(
    '/contents/:id/chapters/bulk-status',
    async ({ body, currentUser, params, status }) => {
      try {
        const updatedCount = await bulkUpdateChapterStatus(currentUser.id, params.id, body)
        return { updated_count: updatedCount }
      } catch (error) {
        if (error instanceof WriterChapterError) {
          return status(error.statusCode, { message: error.message })
        }

        console.error('Unable to bulk update chapter status', error)
        return status(500, { message: 'ไม่สามารถอัปเดตสถานะตอนได้ กรุณาลองใหม่อีกครั้ง' })
      }
    },
    {
      auth: USER_ROLE.WRITER,
      params: writerContentParamsSchema,
      body: bulkUpdateChapterStatusBodySchema,
    },
  )
