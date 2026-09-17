import { t } from 'elysia'

export const createTopupBodySchema = t.Object({
  amount: t.Numeric({ minimum: 1, maximum: 3000, multipleOf: 1 }),
})

export const topupParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
})

export const topupHistoryQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 2147483647, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50, multipleOf: 1 })),
})

const tmweasyWebhookDataObjectSchema = t.Object({
  id_pay: t.Union([t.String(), t.Number()]),
  ref1: t.Union([t.String(), t.Number()]),
  amount_check: t.Union([t.String(), t.Number()]),
  amount: t.Union([t.String(), t.Number()]),
  date_pay: t.Optional(t.String()),
  timestamp: t.Optional(t.Number()),
})

export const tmweasyWebhookBodySchema = t.Object({
  data: t.Union([
    t.String({ minLength: 2, maxLength: 10_000 }),
    tmweasyWebhookDataObjectSchema,
  ]),
  signature: t.String({ minLength: 32, maxLength: 32 }),
})
