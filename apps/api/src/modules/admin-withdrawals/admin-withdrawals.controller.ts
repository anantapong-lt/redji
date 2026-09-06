import { status } from 'elysia'
import type { adminWithdrawalActionBodySchema, adminWithdrawalQuerySchema } from './admin-withdrawals.schema'
import { findAdminWithdrawals, getWithdrawalProofUrl, processAdminWithdrawal } from './admin-withdrawals.service'

export async function getAdminWithdrawals(query: typeof adminWithdrawalQuerySchema.static) {
  try { return { requests: await findAdminWithdrawals(query.status ?? null, query.search?.trim() ?? '') } } catch (error) { console.error(error); return status(500, { message: 'ไม่สามารถโหลดคำขอถอนเงินได้' }) }
}
export async function updateAdminWithdrawal(id: string, adminId: string, body: typeof adminWithdrawalActionBodySchema.static) {
  try { return { request: await processAdminWithdrawal(id, adminId, body.action, body.note?.trim() ?? '', body.proof) } } catch (error) { const message = error instanceof Error ? error.message : 'ไม่สามารถจัดการคำขอถอนเงินได้'; return status(message === 'ไม่พบคำขอถอนเงิน' ? 404 : 400, { message }) }
}
export async function getAdminWithdrawalProof(id: string) {
  try { const url = await getWithdrawalProofUrl(id); return url ? { url } : status(404, { message: 'ไม่พบหลักฐานการโอน' }) } catch (error) { console.error(error); return status(500, { message: 'ไม่สามารถเปิดหลักฐานการโอนได้' }) }
}
