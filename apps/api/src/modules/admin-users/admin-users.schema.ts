import { t } from 'elysia'

export const adminUsersQuerySchema = t.Object({
  search: t.Optional(t.String({ maxLength: 255 })),
  status: t.Optional(t.Union([
    t.Literal('active'),
    t.Literal('banned'),
  ])),
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 2147483647, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
})

export const adminUserParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
})

export const updateAdminUserBodySchema = t.Object({
  display_name: t.String({ minLength: 1, maxLength: 100 }),
  username: t.String({ minLength: 3, maxLength: 30 }),
  email: t.String({ format: 'email', maxLength: 320 }),
  status: t.Union([t.Literal('active'), t.Literal('banned')]),
  balance: t.String({ pattern: '^(?:0|[1-9]\\d*)(?:\\.\\d{1,2})?$', maxLength: 20 }),
}, { additionalProperties: false })
