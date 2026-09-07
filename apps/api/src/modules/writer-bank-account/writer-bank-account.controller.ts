import { status } from 'elysia'
import type { createWriterBankAccountBodySchema } from './writer-bank-account.schema'
import { findBankConfigs, findWriterBankAccount, upsertWriterBankAccount } from './writer-bank-account.service'

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

export async function submitWriterBankAccount(
  userId: string,
  body: typeof createWriterBankAccountBodySchema.static,
) {
  try {
    return { account: await upsertWriterBankAccount(userId, body) }
  } catch (error) {
    console.error('Unable to submit writer application', error)
    return status(500, { message: 'ไม่สามารถส่งใบสมัครนักเขียนได้ กรุณาลองใหม่อีกครั้ง' })
  }
}
