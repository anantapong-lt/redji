import { S3Client } from 'bun'
import { db } from '../../db'
import { env } from '../../config/env'
import { WITHDRAWAL_STATUS, type WithdrawalStatus } from '../../models/withdrawal.model'

interface WithdrawalRow {
  id: string
  writer_user_id: string
  display_name: string
  username: string
  requested_amount: string
  commission_amount: string
  net_amount: string
  bank_code: string
  account_number: string
  requested_at: Date
  status: WithdrawalStatus
  approval_note: string | null
  rejection_reason: string | null
  transfer_proof_key: string | null
  reviewed_by: string | null
}

function r2() {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_TRANSFER_PROOF_BUCKET_NAME)
    throw new Error('R2 transfer-proof configuration is incomplete')
  return new S3Client({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_TRANSFER_PROOF_BUCKET_NAME,
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  })
}
function map(row: WithdrawalRow) {
  return {
    id: row.id,
    user: { id: row.writer_user_id, display_name: row.display_name, username: row.username },
    requested_amount: row.requested_amount,
    commission_amount: row.commission_amount,
    net_amount: row.net_amount,
    bank_code: row.bank_code,
    account_number: row.account_number,
    requested_at: row.requested_at,
    status: row.status,
  note: row.status === WITHDRAWAL_STATUS.REJECTED ? row.rejection_reason : row.approval_note,
    processed_by: row.reviewed_by,
    has_proof: Boolean(row.transfer_proof_key),
  }
}
const select = `wr.id, wr.writer_user_id, u.display_name, u.username, wr.requested_amount::TEXT, wr.commission_amount::TEXT, wr.net_amount::TEXT, wr.bank_code, wr.account_number, wr.requested_at, wr.status, wr.approval_note, wr.rejection_reason, wr.transfer_proof_key, reviewer.email AS reviewed_by`

export async function findAdminWithdrawals(selectedStatus: WithdrawalStatus | null, search: string) {
  const rows = await db<WithdrawalRow[]>`
    SELECT ${db.unsafe(select)} FROM withdrawal_requests wr JOIN users u ON u.id = wr.writer_user_id LEFT JOIN users reviewer ON reviewer.id = wr.reviewed_by_user_id
    WHERE (${selectedStatus}::withdrawal_request_status IS NULL OR wr.status = ${selectedStatus})
      AND (${search} = '' OR STRPOS(LOWER(u.display_name), LOWER(${search})) > 0 OR STRPOS(LOWER(u.username), LOWER(${search})) > 0 OR STRPOS(LOWER(wr.id::TEXT), LOWER(${search})) > 0)
    ORDER BY wr.requested_at DESC, wr.id DESC
  `
  return rows.map(map)
}

async function uploadProof(file: File, requestId: string) {
  const extension = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg'
  const key = `withdrawal-proofs/${requestId}/${crypto.randomUUID()}.${extension}`
  await r2().write(key, new Blob([await file.arrayBuffer()], { type: file.type }), { type: file.type })
  return key
}

export async function processAdminWithdrawal(
  id: string,
  adminId: string,
  action: 'approve' | 'reject' | 'pay',
  note: string,
  proof?: File,
) {
  if (action === 'approve' && !proof) throw new Error('กรุณาแนบหลักฐานการโอน')
  if (action === 'reject' && !note) throw new Error('กรุณาระบุเหตุผลที่ปฏิเสธ')
  const nextStatus: WithdrawalStatus = action === 'approve' ? WITHDRAWAL_STATUS.APPROVED : action === 'reject' ? WITHDRAWAL_STATUS.REJECTED : WITHDRAWAL_STATUS.PAID
  const proofKey = proof ? await uploadProof(proof, id) : null
  const rows = await db.begin(async (tx) => {
    const [current] = await tx<
      WithdrawalRow[]
    >`SELECT ${tx.unsafe(select)} FROM withdrawal_requests wr JOIN users u ON u.id = wr.writer_user_id LEFT JOIN users reviewer ON reviewer.id = wr.reviewed_by_user_id WHERE wr.id = ${id} FOR UPDATE`
    if (!current) throw new Error('ไม่พบคำขอถอนเงิน')
    if (
      (action === 'approve' && current.status !== WITHDRAWAL_STATUS.PENDING) ||
      (action === 'reject' && current.status !== WITHDRAWAL_STATUS.PENDING) ||
      (action === 'pay' && current.status !== WITHDRAWAL_STATUS.APPROVED)
    )
      throw new Error('สถานะคำขอไม่สามารถเปลี่ยนได้')
    await tx`
      UPDATE withdrawal_requests SET status = ${nextStatus}, reviewed_by_user_id = ${adminId}, approval_note = ${action === 'approve' ? note || null : current.approval_note}, rejection_reason = ${action === 'reject' ? note : current.rejection_reason}, transfer_proof_key = COALESCE(${proofKey}, transfer_proof_key), approved_at = CASE WHEN ${action} = 'approve' THEN NOW() ELSE approved_at END, paid_at = CASE WHEN ${action} = 'pay' THEN NOW() ELSE paid_at END, rejected_at = CASE WHEN ${action} = 'reject' THEN NOW() ELSE rejected_at END, updated_at = NOW() WHERE id = ${id}
    `
    await tx`INSERT INTO withdrawal_request_events (withdrawal_request_id, from_status, to_status, note, actor_user_id) VALUES (${id}, ${current.status}, ${nextStatus}, ${note || null}, ${adminId})`
    return tx<
      WithdrawalRow[]
    >`SELECT ${tx.unsafe(select)} FROM withdrawal_requests wr JOIN users u ON u.id = wr.writer_user_id LEFT JOIN users reviewer ON reviewer.id = wr.reviewed_by_user_id WHERE wr.id = ${id}`
  })
  return map(rows[0]!)
}

export async function getWithdrawalProofUrl(id: string) {
  const [row] = await db<
    { transfer_proof_key: string | null }[]
  >`SELECT transfer_proof_key FROM withdrawal_requests WHERE id = ${id}`
  return row?.transfer_proof_key ? r2().presign(row.transfer_proof_key, { expiresIn: 5 * 60, method: 'GET' }) : null
}
