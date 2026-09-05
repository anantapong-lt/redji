import { t } from 'elysia'

export const writerPurchasesQuerySchema = t.Object({
  search: t.Optional(t.String({ maxLength: 255 })),
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 2147483647, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
})
