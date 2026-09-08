import { t } from 'elysia'

export const notificationsQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 1_000_000 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
})

export const notificationParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
})
