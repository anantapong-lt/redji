import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import {
  favoritePublicContent,
  getPublicChapter,
  getPublicMangaChapterPages,
  getPublicContent,
  getPublicContentChapters,
  getPublicContentSitemap,
  ratePublicContent,
  unfavoritePublicContent,
} from './content.controller'
import {
  contentChapterParamsSchema,
  contentChaptersQuerySchema,
  contentReaderPagesQuerySchema,
  contentParamsSchema,
  contentRatingBodySchema,
} from './content.schema'

export const contentRoutes = new Elysia({ prefix: '/contents' })
  .use(authMiddleware)
  .get('', () => getPublicContentSitemap())
  .post(
    '/:slug/favorite',
    ({ currentUser, params }) => favoritePublicContent(params.slug, currentUser.id),
    { auth: true, params: contentParamsSchema },
  )
  .delete(
    '/:slug/favorite',
    ({ currentUser, params }) => unfavoritePublicContent(params.slug, currentUser.id),
    { auth: true, params: contentParamsSchema },
  )
  .post(
    '/:slug/rating',
    ({ body, currentUser, params }) => ratePublicContent(
      params.slug,
      currentUser.id,
      body.rating,
    ),
    { auth: true, params: contentParamsSchema, body: contentRatingBodySchema },
  )
  .get(
    '/:slug/chapters',
    ({ currentUser, params, query }) => getPublicContentChapters(
      params.slug,
      query.page,
      query.limit,
      query.sort,
      currentUser?.id ?? null,
    ),
    {
      optionalAuth: true,
      params: contentParamsSchema,
      query: contentChaptersQuerySchema,
    },
  )
  .get(
    '/:slug/chapters/:chapterNumber/read/pages',
    ({ currentUser, params, query }) => getPublicMangaChapterPages(
      params.slug,
      params.chapterNumber,
      currentUser?.id ?? null,
      query.page ?? 1,
      query.limit ?? 5,
    ),
    {
      optionalAuth: true,
      params: contentChapterParamsSchema,
      query: contentReaderPagesQuerySchema,
    },
  )
  .get(
    '/:slug/chapters/:chapterNumber/read',
    ({ currentUser, params, query }) => getPublicChapter(
      params.slug,
      params.chapterNumber,
      currentUser?.id ?? null,
      query.page ?? 1,
      query.limit ?? 5,
    ),
    {
      optionalAuth: true,
      params: contentChapterParamsSchema,
      query: contentReaderPagesQuerySchema,
    },
  )
  .get(
    '/:slug',
    ({ currentUser, params }) => getPublicContent(params.slug, currentUser?.id ?? null),
    { optionalAuth: true, params: contentParamsSchema },
  )
