import { status } from 'elysia'
import type { createWriterWithdrawalBodySchema, writerWithdrawalQuerySchema } from './writer-withdrawals.schema'
import { createWriterWithdrawal, getWriterWithdrawals, WriterWithdrawalError } from './writer-withdrawals.service'

export async function getWriterWithdrawalsResponse(
  userId: string,
  query: typeof writerWithdrawalQuerySchema.static,
) {
  try {
    return await getWriterWithdrawals(userId, query.page ?? 1, query.limit ?? 10)
  } catch (error) {
    console.error('Unable to load writer withdrawals', error)
    return status(500, { message: 'ไม่สามารถโหลดข้อมูลการถอนเงินได้' })
  }
}

export async function createWriterWithdrawalResponse(
  userId: string,
  body: typeof createWriterWithdrawalBodySchema.static,
) {
  try {
    return status(201, await createWriterWithdrawal(userId, body.amount))
  } catch (error) {
    if (error instanceof WriterWithdrawalError) return status(error.statusCode, { message: error.message })
    console.error('Unable to create writer withdrawal', error)
    return status(500, { message: 'ไม่สามารถส่งคำขอถอนเงินได้' })
  }
}
