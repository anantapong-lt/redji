import { t } from 'elysia'

export const createTopupBodySchema = t.Object({
  amount: t.Numeric({ minimum: 1, maximum: 3000, multipleOf: 1 }),
})

export const topupParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
})

export const tmweasyWebhookBodySchema = t.Object({
  data: t.String({ minLength: 2, maxLength: 10_000 }),
  signature: t.String({ minLength: 32, maxLength: 32 }),
})
