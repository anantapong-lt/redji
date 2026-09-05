import { status } from 'elysia'
import { countWriterPurchases, findWriterPurchases } from './writer-purchase.service'

export async function getWriterPurchases(
  userId: string,
  query: { page?: number; limit?: number },
) {
  try {
    const limit = query.limit ?? 10
    const total = await countWriterPurchases(userId)
    const totalPages = Math.ceil(total / limit)
    const page = Math.min(query.page ?? 1, Math.max(totalPages, 1))
    const purchases = await findWriterPurchases(userId, page, limit)
    return { purchases, pagination: { page, limit, total, totalPages } }
  } catch (error) {
    console.error('Unable to load writer purchases', error)
    return status(500, { message: 'ไม่สามารถโหลดรายการซื้อตอนได้ กรุณาลองใหม่อีกครั้ง' })
  }
}
