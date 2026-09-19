import { t } from 'elysia'

export const agreementTypeSchema = t.Union([t.Literal('website'), t.Literal('writer')])

export const agreementTypeParamsSchema = t.Object({
  type: agreementTypeSchema,
})

export const agreementIdParamsSchema = t.Object({
  type: agreementTypeSchema,
  id: t.String({ format: 'uuid' }),
})

export const createAgreementBodySchema = t.Object({
  content_html: t.String({ minLength: 1 }),
})

export const updateAgreementStatusBodySchema = t.Object({
  is_active: t.Boolean(),
})
