import { t } from 'elysia'

export const contentParamsSchema = t.Object({
  slug: t.String({ minLength: 1, maxLength: 255 }),
})

export const contentChaptersQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
})
