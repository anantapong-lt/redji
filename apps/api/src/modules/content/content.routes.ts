import { Elysia } from 'elysia'
import {
  getPublicContent,
  getPublicContentChapters,
  getPublicContentSitemap,
} from './content.controller'
import { contentChaptersQuerySchema, contentParamsSchema } from './content.schema'

export const contentRoutes = new Elysia({ prefix: '/contents' })
  .get('', () => getPublicContentSitemap())
  .get(
    '/:slug/chapters',
    ({ params, query }) => getPublicContentChapters(
      params.slug,
      query.page ?? 1,
      query.limit ?? 25,
    ),
    { params: contentParamsSchema, query: contentChaptersQuerySchema },
  )
  .get(
    '/:slug',
    ({ params }) => getPublicContent(params.slug),
    { params: contentParamsSchema },
  )
