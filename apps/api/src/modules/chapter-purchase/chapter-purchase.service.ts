import { db } from '../../db'
import type {
  ChapterPurchase,
  ExistingChapterPurchase,
  PurchaseAccount,
  PurchasableChapter,
} from '../../models/chapter-purchase.model'

const WRITER_REVENUE_RATE = '0.85'

type PurchaseErrorStatus = 400 | 402 | 403 | 404 | 409

export class ChapterPurchaseError extends Error {
  constructor(
    message: string,
    readonly statusCode: PurchaseErrorStatus,
  ) {
    super(message)
    this.name = 'ChapterPurchaseError'
  }
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && error.code === '23505',
  )
}

export async function purchaseChapter(
  buyerUserId: string,
  chapterId: string,
): Promise<ChapterPurchase> {
  try {
    return await db.begin(async (transaction) => {
      const [chapter] = await transaction<PurchasableChapter[]>`
        SELECT
          chapters.id,
          chapters.is_free,
          chapters.price::TEXT,
          stories.creator_user_id AS writer_user_id
        FROM chapters
        INNER JOIN stories ON stories.id = chapters.story_id
        WHERE chapters.id = ${chapterId}
          AND chapters.status = 'published'
          AND stories.status IN ('ongoing', 'completed')
          AND stories.deleted_at IS NULL
        FOR UPDATE OF chapters
      `

      if (!chapter) {
        throw new ChapterPurchaseError('ไม่พบตอนที่พร้อมจำหน่าย', 404)
      }

      if (chapter.writer_user_id === buyerUserId) {
        throw new ChapterPurchaseError('ไม่สามารถซื้อผลงานของตนเองได้', 403)
      }

      if (chapter.is_free || Number(chapter.price) <= 0) {
        throw new ChapterPurchaseError('ตอนนี้เปิดให้อ่านฟรีหรือยังไม่ได้กำหนดราคา', 400)
      }

      const accounts = await transaction<PurchaseAccount[]>`
        SELECT id, balance::TEXT, status, deleted_at
        FROM users
        WHERE id IN (${buyerUserId}, ${chapter.writer_user_id})
        ORDER BY id
        FOR UPDATE
      `

      const buyer = accounts.find((account) => account.id === buyerUserId)

      if (!buyer || buyer.status !== 'active' || buyer.deleted_at) {
        throw new ChapterPurchaseError('ไม่พบบัญชีผู้ซื้อที่พร้อมใช้งาน', 404)
      }

      const [existingPurchase] = await transaction<ExistingChapterPurchase[]>`
        SELECT id
        FROM chapter_purchases
        WHERE buyer_user_id = ${buyerUserId}
          AND chapter_id = ${chapterId}
        LIMIT 1
      `

      if (existingPurchase) {
        throw new ChapterPurchaseError('คุณซื้อตอนนี้แล้ว', 409)
      }

      if (Number(buyer.balance) < Number(chapter.price)) {
        throw new ChapterPurchaseError('ยอดเงินคงเหลือไม่เพียงพอ', 402)
      }

      const [purchase] = await transaction<ChapterPurchase[]>`
        INSERT INTO chapter_purchases (
          buyer_user_id,
          writer_user_id,
          chapter_id,
          price,
          writer_revenue,
          platform_revenue
        ) VALUES (
          ${buyerUserId},
          ${chapter.writer_user_id},
          ${chapter.id},
          ${chapter.price}::NUMERIC,
          ROUND(${chapter.price}::NUMERIC * ${WRITER_REVENUE_RATE}::NUMERIC, 2),
          ${chapter.price}::NUMERIC
            - ROUND(${chapter.price}::NUMERIC * ${WRITER_REVENUE_RATE}::NUMERIC, 2)
        )
        RETURNING
          id,
          chapter_id,
          price::TEXT,
          writer_revenue::TEXT,
          platform_revenue::TEXT,
          purchased_at
      `

      if (!purchase) throw new Error('Unable to create chapter purchase')

      await transaction`
        UPDATE users
        SET balance = balance - ${purchase.price}::NUMERIC, updated_at = NOW()
        WHERE id = ${buyerUserId}
      `

      await transaction`
        UPDATE users
        SET balance = balance + ${purchase.writer_revenue}::NUMERIC, updated_at = NOW()
        WHERE id = ${chapter.writer_user_id}
      `

      return purchase
    })
  } catch (error) {
    if (error instanceof ChapterPurchaseError) throw error
    if (isUniqueViolation(error)) {
      throw new ChapterPurchaseError('คุณซื้อตอนนี้แล้ว', 409)
    }
    throw error
  }
}
