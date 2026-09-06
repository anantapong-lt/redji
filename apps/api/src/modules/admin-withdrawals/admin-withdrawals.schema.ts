import { t } from 'elysia'
import { WITHDRAWAL_STATUSES } from '../../models/withdrawal.model'

export const adminWithdrawalQuerySchema = t.Object({
  status: t.Optional(t.UnionEnum(WITHDRAWAL_STATUSES)),
  search: t.Optional(t.String({ maxLength: 255 })),
})
export const adminWithdrawalParamsSchema = t.Object({ id: t.String({ format: 'uuid' }) })
export const adminWithdrawalActionBodySchema = t.Object({
  action: t.Union([t.Literal('approve'), t.Literal('reject'), t.Literal('pay')]),
  note: t.Optional(t.String({ maxLength: 2000 })),
  proof: t.Optional(t.File({ type: ['image/jpeg', 'image/png', 'application/pdf'], maxSize: '10m' })),
})
