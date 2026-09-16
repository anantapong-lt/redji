import { Elysia } from 'elysia'
import { localChapterPageResponse } from './writer-chapter-page.controller'
import { localChapterPageQuerySchema } from './writer-chapter-page.schema'

export const writerChapterPageRoutes = new Elysia()
  .get('/assets/manga', ({ query }) => localChapterPageResponse(query), {
    query: localChapterPageQuerySchema,
  })
