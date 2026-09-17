import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import {
  purchasePublicChapter,
  purchasePublicChapters,
  getUserChapterPurchaseHistory,
} from './chapter-purchase.controller'
import {
  bulkChapterPurchaseBodySchema,
  chapterPurchaseHistoryQuerySchema,
  chapterPurchaseParamsSchema,
} from './chapter-purchase.schema'

export const chapterPurchaseRoutes = new Elysia({ prefix: '/chapters' })
  .use(authMiddleware)
  .get(
    '/purchases',
    ({ currentUser, query }) => getUserChapterPurchaseHistory(currentUser.id, query),
    { auth: true, query: chapterPurchaseHistoryQuerySchema },
  )
  .post(
    '/purchase',
    ({ body, currentUser }) => purchasePublicChapters(currentUser.id, body.chapter_ids),
    { auth: true, body: bulkChapterPurchaseBodySchema },
  )
  .post(
    '/:chapterId/purchase',
    ({ currentUser, params }) => purchasePublicChapter(currentUser.id, params.chapterId),
    { auth: true, params: chapterPurchaseParamsSchema },
  )
