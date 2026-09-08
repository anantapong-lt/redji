import { t } from 'elysia'
import { WRITER_APPLICATION_STATUSES } from '../../models/writer-application.model'

export const adminWriterApplicationsQuerySchema = t.Object({
  status: t.Optional(t.UnionEnum(WRITER_APPLICATION_STATUSES)),
  search: t.Optional(t.String({ maxLength: 255 })),
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 2_147_483_647, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
})

export const adminWriterApplicationParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
})

export const adminWriterApplicationActionBodySchema = t.Object({
  action: t.Union([t.Literal('approve'), t.Literal('reject')]),
  note: t.Optional(t.String({ maxLength: 2_000 })),
}, { additionalProperties: false })
