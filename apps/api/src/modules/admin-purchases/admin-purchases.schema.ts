import { t } from 'elysia'

const dateSchema = t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })

export const adminPurchasesQuerySchema = t.Object({
  story_id: t.Optional(t.String({ format: 'uuid' })),
  user_ids: t.Optional(t.String({ maxLength: 1_850 })),
  date_from: t.Optional(dateSchema),
  date_to: t.Optional(dateSchema),
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 2_147_483_647, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
})

export const adminPurchaseStoriesQuerySchema = t.Object({
  search: t.Optional(t.String({ maxLength: 255 })),
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 2_147_483_647, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50, multipleOf: 1 })),
})

export const adminPurchaseUsersQuerySchema = t.Object({
  search: t.Optional(t.String({ maxLength: 255 })),
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 2_147_483_647, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50, multipleOf: 1 })),
})
