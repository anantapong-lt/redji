import { t } from 'elysia'
import { USER_STATUS } from '../../models/user.model'

export const adminWritersQuerySchema = t.Object({
  search: t.Optional(t.String({ maxLength: 255 })),
  status: t.Optional(t.Union([t.Literal(USER_STATUS.ACTIVE), t.Literal(USER_STATUS.BANNED)])),
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 2_147_483_647, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
})

export const adminWriterStatusBodySchema = t.Object({
  status: t.Union([t.Literal(USER_STATUS.ACTIVE), t.Literal(USER_STATUS.BANNED)]),
  ban_reason: t.Optional(t.String({ minLength: 1, maxLength: 1_000 })),
}, { additionalProperties: false })

export const adminWriterParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
})
