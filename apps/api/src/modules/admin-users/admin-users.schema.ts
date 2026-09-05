import { t } from 'elysia'

export const adminUsersQuerySchema = t.Object({
  search: t.Optional(t.String({ maxLength: 255 })),
  status: t.Optional(t.Union([
    t.Literal('active'),
    t.Literal('suspended'),
    t.Literal('banned'),
  ])),
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 2147483647, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
})
