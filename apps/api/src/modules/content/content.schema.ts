import { t } from 'elysia'

export const contentParamsSchema = t.Object({
  slug: t.String({ minLength: 1, maxLength: 255 }),
})

export const contentChapterParamsSchema = t.Object({
  slug: t.String({ minLength: 1, maxLength: 255 }),
  chapterNumber: t.String({ pattern: '^\\d{1,8}(?:\\.\\d{1,2})?$' }),
})

export const contentReaderPagesQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 25, multipleOf: 1 })),
})

export const contentRatingBodySchema = t.Object({
  rating: t.Numeric({ minimum: 1, maximum: 5, multipleOf: 1 }),
})

export const chapterCommentBodySchema = t.Object({
  body: t.String({ minLength: 1, maxLength: 2000 }),
  parent_comment_id: t.Optional(t.String({ format: 'uuid' })),
})

export const chapterCommentEditBodySchema = t.Object({
  body: t.String({ minLength: 1, maxLength: 2000 }),
})

export const chapterCommentReactionBodySchema = t.Object({
  reaction: t.Union([
    t.Literal('like'),
    t.Literal('love'),
    t.Literal('wow'),
    t.Literal('haha'),
    t.Literal('sad'),
    t.Literal('angry'),
  ]),
})

export const chapterCommentsQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 20, multipleOf: 1 })),
})

export const chapterCommentParamsSchema = t.Object({
  ...contentChapterParamsSchema.properties,
  commentId: t.String({ format: 'uuid' }),
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
