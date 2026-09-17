import { t } from 'elysia'

export const chapterPurchaseParamsSchema = t.Object({
  chapterId: t.String({ format: 'uuid' }),
})

export const bulkChapterPurchaseBodySchema = t.Object({
  chapter_ids: t.Array(t.String({ format: 'uuid' }), {
    minItems: 1,
    maxItems: 25,
    uniqueItems: true,
  }),
})

export const chapterPurchaseHistoryQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 2147483647, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50, multipleOf: 1 })),
})
