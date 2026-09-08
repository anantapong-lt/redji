import { t } from 'elysia'

export const writerWithdrawalQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 1_000_000 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
})

export const createWriterWithdrawalBodySchema = t.Object({
  amount: t.String({ pattern: '^(?:0|[1-9]\\d{0,9})(?:\\.\\d{1,2})?$', maxLength: 13 }),
})
