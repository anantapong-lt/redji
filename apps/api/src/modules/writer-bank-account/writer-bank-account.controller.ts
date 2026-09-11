import { status } from 'elysia'
import type { createWriterBankAccountBodySchema } from './writer-bank-account.schema'
import { findBankConfigs, findWriterApplicationStatus, findWriterBankAccount, hasProfileSocialLink, upsertWriterBankAccount, WriterBankAccountError } from './writer-bank-account.service'
import { isFeatureEnabled } from '../site-config/site-config.service'

export async function getBankConfigs() {
  try {
    return { banks: await findBankConfigs() }
  } catch (error) {
    console.error('Unable to load bank configs', error)
    return status(500, { message: 'ไม่สามารถโหลดรายการธนาคารได้' })
  }
}

export async function getWriterBankAccount(userId: string) {
  try {
    return { account: await findWriterBankAccount(userId) }
  } catch (error) {
    console.error('Unable to load writer bank account', error)
    return status(500, { message: 'ไม่สามารถโหลดข้อมูลบัญชีธนาคารได้' })
  }
}

export async function getWriterApplicationStatus(userId: string) {
  try {
    return { status: await findWriterApplicationStatus(userId) }
  } catch (error) {
    console.error('Unable to load writer application status', error)
    return status(500, { message: 'ไม่สามารถตรวจสอบสถานะใบสมัครนักเขียนได้' })
  }
}

export async function submitWriterBankAccount(
  userId: string,
  body: typeof createWriterBankAccountBodySchema.static,
) {
  try {
    if (!(await isFeatureEnabled('writer_application'))) {
      return status(403, { message: 'ขณะนี้ระบบปิดรับสมัครเป็นนักเขียนชั่วคราว' })
    }
    if (!(await hasProfileSocialLink(userId))) {
      return status(400, { message: 'กรุณาเพิ่ม Social ในหน้าโปรไฟล์อย่างน้อย 1 รายการก่อนสมัครเป็นนักเขียน' })
    }
    return { account: await upsertWriterBankAccount(userId, body) }
  } catch (error) {
    if (error instanceof WriterBankAccountError) return status(error.statusCode, { message: error.message })
    console.error('Unable to submit writer application', error)
    return status(500, { message: 'ไม่สามารถส่งใบสมัครนักเขียนได้ กรุณาลองใหม่อีกครั้ง' })
  }
}
