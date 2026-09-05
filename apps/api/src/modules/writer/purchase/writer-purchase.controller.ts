import { status } from 'elysia'
import { countWriterPurchases, findWriterPurchases } from './writer-purchase.service'
import type { writerPurchasesQuerySchema } from './writer-purchase.schema'

export async function getWriterPurchases(
  userId: string,
  query: typeof writerPurchasesQuerySchema.static,
) {
  try {
    const limit = query.limit ?? 10
    const search = query.search?.trim() ?? ''
    const total = await countWriterPurchases(userId, search)
    const totalPages = Math.ceil(total / limit)
    const page = Math.min(query.page ?? 1, Math.max(totalPages, 1))
    const purchases = await findWriterPurchases(userId, page, limit, search)
    return { purchases, pagination: { page, limit, total, totalPages } }
  } catch (error) {
    console.error('Unable to load writer purchases', error)
    return status(500, { message: 'ไม่สามารถโหลดรายการซื้อตอนได้ กรุณาลองใหม่อีกครั้ง' })
  }
}
