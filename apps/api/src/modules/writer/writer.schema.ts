import { t } from 'elysia'

export const writerDashboardQuerySchema = t.Object({
  period: t.Optional(t.UnionEnum(['today', 'this-week', 'this-month'])),
})
