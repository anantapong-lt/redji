import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import {
  getWriterStatsResponse,
  getWriterContentsResponse,
  createWriterContentResponse,
  getWriterContentResponse,
  createWriterChapterResponse,
  getWriterChapterResponse,
  updateWriterChapterResponse,
  updateWriterContentResponse,
  getWriterChaptersResponse,
  bulkUpdateChapterPriceResponse,
  bulkUpdateChapterStatusResponse,
} from './writer.controller'
import {
  createWriterContentBodySchema,
  updateWriterContentBodySchema,
  writerContentParamsSchema,
  writerContentsQuerySchema,
} from './content/writer-content.schema'
import {
  bulkUpdateChapterPriceBodySchema,
  bulkUpdateChapterStatusBodySchema,
  createWriterChapterBodySchema,
  updateWriterChapterBodySchema,
  writerChaptersQuerySchema,
  writerChapterParamsSchema,
  writerChaptersParamsSchema,
} from './chapter/writer-chapter.schema'
import { getWriterOverview } from './overview/writer-overview.controller'
import { writerOverviewQuerySchema } from './overview/writer-overview.schema'
import { getWriterPurchases } from './purchase/writer-purchase.controller'
import { writerPurchasesQuerySchema } from './purchase/writer-purchase.schema'

export const writerRoutes = new Elysia({ prefix: '/writer' })
  .use(authMiddleware)
  .get(
    '/purchases',
    ({ currentUser, query }) => getWriterPurchases(currentUser.id, query),
    {
      auth: USER_ROLE.WRITER,
      query: writerPurchasesQuerySchema,
    },
  )
  .get(
    '/contents/:id/overview',
    ({ currentUser, params, query }) => getWriterOverview(currentUser.id, params.id, query),
    {
      auth: USER_ROLE.WRITER,
      params: writerContentParamsSchema,
      query: writerOverviewQuerySchema,
    },
  )
  .get(
    '/stats',
    ({ currentUser }) => getWriterStatsResponse(currentUser.id),
    { auth: USER_ROLE.WRITER },
  )
  .get(
    '/contents',
    ({ currentUser, query }) => getWriterContentsResponse(currentUser.id, query),
    {
      auth: USER_ROLE.WRITER,
      query: writerContentsQuerySchema,
    },
  )
  .post(
    '/contents',
    ({ currentUser, body }) => createWriterContentResponse(currentUser.id, body),
    {
      auth: USER_ROLE.WRITER,
      body: createWriterContentBodySchema,
    },
  )
  .get(
    '/contents/:id',
    ({ currentUser, params }) => getWriterContentResponse(currentUser.id, params.id),
    {
      auth: USER_ROLE.WRITER,
      params: writerContentParamsSchema,
    },
  )
  .post(
    '/contents/:id/chapters',
    ({ currentUser, params, body }) => createWriterChapterResponse(currentUser.id, params.id, body),
    {
      auth: USER_ROLE.WRITER,
      params: writerChaptersParamsSchema,
      body: createWriterChapterBodySchema,
    },
  )
  .get(
    '/contents/:id/chapters/:chapterId',
    ({ currentUser, params }) => getWriterChapterResponse(currentUser.id, params.id, params.chapterId),
    {
      auth: USER_ROLE.WRITER,
      params: writerChapterParamsSchema,
    },
  )
  .patch(
    '/contents/:id/chapters/:chapterId',
    ({ currentUser, params, body }) => updateWriterChapterResponse(
      currentUser.id,
      params.id,
      params.chapterId,
      body,
    ),
    {
      auth: USER_ROLE.WRITER,
      params: writerChapterParamsSchema,
      body: updateWriterChapterBodySchema,
    },
  )
  .patch(
    '/contents/:id',
    ({ currentUser, params, body }) => updateWriterContentResponse(currentUser.id, params.id, body),
    {
      auth: USER_ROLE.WRITER,
      params: writerContentParamsSchema,
      body: updateWriterContentBodySchema,
    },
  )
  .get(
    '/contents/:id/chapters',
    ({ currentUser, params, query }) => getWriterChaptersResponse(currentUser.id, params.id, query),
    {
      auth: USER_ROLE.WRITER,
      params: writerChaptersParamsSchema,
      query: writerChaptersQuerySchema,
    },
  )
  .patch(
    '/contents/:id/chapters/bulk-price',
    ({ currentUser, params, body }) => bulkUpdateChapterPriceResponse(currentUser.id, params.id, body),
    {
      auth: USER_ROLE.WRITER,
      params: writerChaptersParamsSchema,
      body: bulkUpdateChapterPriceBodySchema,
    },
  )
  .patch(
    '/contents/:id/chapters/bulk-status',
    ({ currentUser, params, body }) => bulkUpdateChapterStatusResponse(currentUser.id, params.id, body),
    {
      auth: USER_ROLE.WRITER,
      params: writerChaptersParamsSchema,
      body: bulkUpdateChapterStatusBodySchema,
    },
  )
