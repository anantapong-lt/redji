import { status } from 'elysia'
import type {
  agreementIdParamsSchema,
  agreementTypeParamsSchema,
  createAgreementBodySchema,
  updateAgreementStatusBodySchema,
} from './agreements.schema'
import {
  createAgreement,
  findActiveAgreement,
  findAgreements,
  setAgreementActive,
} from './agreements.service'

export async function getActiveAgreement(params: typeof agreementTypeParamsSchema.static) {
  return { agreement: await findActiveAgreement(params.type) }
}

export async function getAdminAgreements(params: typeof agreementTypeParamsSchema.static) {
  return { agreements: await findAgreements(params.type) }
}

export async function postAdminAgreement(
  params: typeof agreementTypeParamsSchema.static,
  body: typeof createAgreementBodySchema.static,
) {
  return { agreement: await createAgreement(params.type, body.content_html.trim()) }
}

export async function updateAdminAgreementStatus(
  params: typeof agreementIdParamsSchema.static,
  body: typeof updateAgreementStatusBodySchema.static,
) {
  const updated = await setAgreementActive(params.type, params.id, body.is_active)
  if (!updated) return status(404, { message: 'ไม่พบข้อตกลง' })

  return {
    message: body.is_active
      ? 'เปิดใช้งานข้อตกลงเรียบร้อยแล้ว'
      : 'ปิดใช้งานข้อตกลงเรียบร้อยแล้ว',
  }
}

export async function activateAdminAgreement(params: typeof agreementIdParamsSchema.static) {
  const updated = await setAgreementActive(params.type, params.id, true)
  if (!updated) return status(404, { message: 'ไม่พบข้อตกลง' })
  return { message: 'เปิดใช้งานข้อตกลงเรียบร้อยแล้ว' }
}
