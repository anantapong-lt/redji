import { t } from 'elysia'

export const writerOverviewQuerySchema = t.Object({
  period: t.UnionEnum(['today', 'this-week', 'this-month']),
})
