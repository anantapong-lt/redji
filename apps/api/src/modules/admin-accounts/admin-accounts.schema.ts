import { t } from 'elysia'
import { USER_STATUS } from '../../models/user.model'

export const adminAccountsQuerySchema = t.Object({
  search: t.Optional(t.String({ maxLength: 255 })),
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 2147483647, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
})

export const createAdminAccountBodySchema = t.Object({
  display_name: t.String({ minLength: 1, maxLength: 100 }),
  username: t.String({ minLength: 3, maxLength: 30 }),
  email: t.String({ format: 'email', maxLength: 320 }),
  password: t.String({ minLength: 8, maxLength: 72 }),
}, { additionalProperties: false })

export const adminAccountParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
})

export const adminAccountStatusBodySchema = t.Object({
  status: t.Union([t.Literal(USER_STATUS.ACTIVE), t.Literal(USER_STATUS.BANNED)]),
}, { additionalProperties: false })
