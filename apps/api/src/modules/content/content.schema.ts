import { t } from 'elysia'

export const contentParamsSchema = t.Object({
  slug: t.String({ minLength: 1, maxLength: 255 }),
})

export const contentChapterParamsSchema = t.Object({
  slug: t.String({ minLength: 1, maxLength: 255 }),
  chapterNumber: t.String({ pattern: '^\\d{1,8}(?:\\.\\d)?$' }),
})

export const contentRatingBodySchema = t.Object({
  rating: t.Numeric({ minimum: 1, maximum: 5, multipleOf: 1 }),
})

export const contentChaptersQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
  sort: t.Optional(t.Union([
    t.Literal('latest'),
    t.Literal('oldest'),
    t.Literal('chapter_asc'),
    t.Literal('chapter_desc'),
  ])),
})
