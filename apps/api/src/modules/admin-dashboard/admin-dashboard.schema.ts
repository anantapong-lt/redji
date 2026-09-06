import { t } from 'elysia'

export const adminDashboardQuerySchema = t.Object({
  year: t.Optional(t.Numeric({ minimum: 2000, maximum: 2100 })),
  month: t.Optional(t.Numeric({ minimum: 1, maximum: 12 })),
})
