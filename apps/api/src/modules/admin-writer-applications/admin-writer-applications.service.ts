import { db } from '../../db'
import { NOTIFICATION_TYPE } from '../../models/notification.model'
import { USER_ROLE } from '../../models/user.model'
import { WRITER_APPLICATION_STATUS, type WriterApplicationStatus } from '../../models/writer-application.model'

interface WriterApplicationRow {
  id: string
  writer_user_id: string
  display_name: string
  username: string
  email: string
  account_holder_first_name: string
  account_holder_last_name: string
  bank_code: string
  account_number: string
  application_status: WriterApplicationStatus
  created_at: Date
  reviewed_at: Date | null
  review_note: string | null
  reviewed_by: string | null
  user_role: string
}

const select = `wba.id, wba.writer_user_id, applicant.display_name, applicant.username, applicant.email, wba.account_holder_first_name, wba.account_holder_last_name, wba.bank_code, wba.account_number, wba.application_status, wba.created_at, wba.reviewed_at, wba.review_note, reviewer.email AS reviewed_by, applicant.role AS user_role`

export class WriterApplicationError extends Error {
  constructor(message: string, readonly statusCode: 400 | 404 | 409) {
    super(message)
    this.name = 'WriterApplicationError'
  }
}

export async function countWriterApplications(status: WriterApplicationStatus | null, search: string) {
  const [row] = await db<{ total: string }[]>`
    SELECT COUNT(*)::TEXT AS total
    FROM writer_bank_accounts wba
    INNER JOIN users applicant ON applicant.id = wba.writer_user_id
    WHERE wba.status = 'active'
      AND applicant.deleted_at IS NULL
      AND (${status}::TEXT IS NULL OR wba.application_status = ${status})
      AND (
        ${search} = ''
        OR STRPOS(LOWER(applicant.display_name), LOWER(${search})) > 0
        OR STRPOS(LOWER(applicant.username), LOWER(${search})) > 0
        OR STRPOS(LOWER(applicant.email), LOWER(${search})) > 0
      )
  `
  return Number(row?.total ?? 0)
}

export function findWriterApplications(page: number, limit: number, status: WriterApplicationStatus | null, search: string) {
  return db<WriterApplicationRow[]>`
    SELECT ${db.unsafe(select)}
    FROM writer_bank_accounts wba
    INNER JOIN users applicant ON applicant.id = wba.writer_user_id
    LEFT JOIN users reviewer ON reviewer.id = wba.reviewed_by_user_id
    WHERE wba.status = 'active'
      AND applicant.deleted_at IS NULL
      AND (${status}::TEXT IS NULL OR wba.application_status = ${status})
      AND (
        ${search} = ''
        OR STRPOS(LOWER(applicant.display_name), LOWER(${search})) > 0
        OR STRPOS(LOWER(applicant.username), LOWER(${search})) > 0
        OR STRPOS(LOWER(applicant.email), LOWER(${search})) > 0
      )
    ORDER BY CASE WHEN wba.application_status = ${WRITER_APPLICATION_STATUS.PENDING} THEN 0 ELSE 1 END, wba.created_at DESC, wba.id DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `
}

export async function reviewWriterApplication(
  applicationId: string,
  adminId: string,
  action: 'approve' | 'reject',
  note: string,
) {
  if (action === 'reject' && !note) throw new WriterApplicationError('กรุณาระบุเหตุผลที่ปฏิเสธ', 400)
  const nextStatus = action === 'approve' ? WRITER_APPLICATION_STATUS.APPROVED : WRITER_APPLICATION_STATUS.REJECTED

  return db.begin(async (transaction) => {
    const [current] = await transaction<WriterApplicationRow[]>`
      SELECT ${transaction.unsafe(select)}
      FROM writer_bank_accounts wba
      INNER JOIN users applicant ON applicant.id = wba.writer_user_id
      LEFT JOIN users reviewer ON reviewer.id = wba.reviewed_by_user_id
      WHERE wba.id = ${applicationId} AND wba.status = 'active'
      FOR UPDATE OF wba, applicant
    `
    if (!current) throw new WriterApplicationError('ไม่พบใบสมัครนักเขียน', 404)
    if (current.application_status !== WRITER_APPLICATION_STATUS.PENDING) throw new WriterApplicationError('ใบสมัครนี้ได้รับการพิจารณาแล้ว', 409)
    if (current.user_role !== USER_ROLE.USER) throw new WriterApplicationError('บัญชีผู้สมัครไม่อยู่ในสถานะที่อนุมัติได้', 409)

    await transaction`
      UPDATE writer_bank_accounts
      SET application_status = ${nextStatus}, reviewed_by_user_id = ${adminId}, reviewed_at = NOW(), review_note = ${note || null}, updated_at = NOW()
      WHERE id = ${applicationId}
    `
    if (action === 'approve') {
      await transaction`
        UPDATE users
        SET role = ${USER_ROLE.WRITER}, updated_at = NOW()
        WHERE id = ${current.writer_user_id}
      `
    }
    const approved = action === 'approve'
    const title = approved ? 'คำขอเป็นนักเขียนได้รับการอนุมัติ' : 'คำขอเป็นนักเขียนไม่ได้รับการอนุมัติ'
    const message = approved
      ? `คำขอเป็นนักเขียนของคุณได้รับการอนุมัติแล้ว${note ? `\nหมายเหตุ: ${note}` : ''}`
      : `คำขอเป็นนักเขียนของคุณถูกปฏิเสธ\nเหตุผล: ${note}`
    await transaction`
      INSERT INTO notifications (user_id, type, title, message, target_url, data)
      VALUES (
        ${current.writer_user_id},
        ${approved ? NOTIFICATION_TYPE.WRITER_APPLICATION_APPROVED : NOTIFICATION_TYPE.WRITER_APPLICATION_REJECTED},
        ${title},
        ${message},
        '/notifications',
        ${JSON.stringify({ writer_application_id: applicationId, status: nextStatus })}::JSONB
      )
    `
    const [reviewed] = await transaction<WriterApplicationRow[]>`
      SELECT ${transaction.unsafe(select)}
      FROM writer_bank_accounts wba
      INNER JOIN users applicant ON applicant.id = wba.writer_user_id
      LEFT JOIN users reviewer ON reviewer.id = wba.reviewed_by_user_id
      WHERE wba.id = ${applicationId}
    `
    if (!reviewed) throw new Error('Unable to reload writer application')
    return reviewed
  })
}
