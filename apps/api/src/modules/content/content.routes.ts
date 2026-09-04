import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import {
  getPublicContent,
  getPublicContentChapters,
  getPublicContentSitemap,
} from './content.controller'
import { contentChaptersQuerySchema, contentParamsSchema } from './content.schema'

export const contentRoutes = new Elysia({ prefix: '/contents' })
  .use(authMiddleware)
  .get('', () => getPublicContentSitemap())
  .get(
    '/:slug/chapters',
    ({ currentUser, params, query }) => getPublicContentChapters(
      params.slug,
      query.page ?? 1,
      query.limit ?? 25,
      currentUser?.id ?? null,
    ),
    {
      optionalAuth: true,
      params: contentParamsSchema,
      query: contentChaptersQuerySchema,
    },
  )
  .get(
    '/:slug',
    ({ params }) => getPublicContent(params.slug),
    { params: contentParamsSchema },
  )
