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
