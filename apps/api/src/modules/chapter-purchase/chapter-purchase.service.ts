import { db } from '../../db'
import type {
  ChapterPurchase,
  ExistingChapterPurchase,
  PurchaseAccount,
  PurchasableChapter,
} from '../../models/chapter-purchase.model'

const WRITER_REVENUE_RATE = '0.85'

type PurchaseErrorStatus = 400 | 402 | 404 | 409

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
  const [purchase] = await purchaseChapters(buyerUserId, [chapterId])
  if (!purchase) throw new Error('Unable to create chapter purchase')
  return purchase
}

export async function purchaseChapters(
  buyerUserId: string,
  chapterIds: string[],
): Promise<ChapterPurchase[]> {
  try {
    return await db.begin(async (transaction) => {
      const uniqueChapterIds = [...new Set(chapterIds)]
      if (uniqueChapterIds.length === 0 || uniqueChapterIds.length > 25) {
        throw new ChapterPurchaseError('เลือกซื้อตอนได้ครั้งละ 1 ถึง 25 ตอน', 400)
      }

      const chapterIdArray = db.array(uniqueChapterIds, 'UUID')
      const chapters = await transaction<PurchasableChapter[]>`
        SELECT
          chapters.id,
          chapters.is_free,
          chapters.price::TEXT,
          stories.creator_user_id AS writer_user_id
        FROM chapters
        INNER JOIN stories ON stories.id = chapters.story_id
        WHERE chapters.id = ANY(${chapterIdArray})
          AND chapters.status = 'published'
          AND stories.status IN ('ongoing', 'completed')
          AND stories.deleted_at IS NULL
        ORDER BY chapters.id
        FOR UPDATE OF chapters
      `

      if (chapters.length !== uniqueChapterIds.length) {
        throw new ChapterPurchaseError('มีบางตอนที่ไม่พร้อมจำหน่าย', 404)
      }

      if (chapters.some((chapter) => chapter.is_free || Number(chapter.price) <= 0)) {
        throw new ChapterPurchaseError('รายการที่เลือกมีตอนฟรีหรือตอนที่ยังไม่ได้กำหนดราคา', 400)
      }

      const writerUserIds = [...new Set(chapters.map((chapter) => chapter.writer_user_id))]
      const accountIds = [...new Set([buyerUserId, ...writerUserIds])]
      const accountIdArray = db.array(accountIds, 'UUID')
      const accounts = await transaction<PurchaseAccount[]>`
        SELECT id, balance::TEXT, status, deleted_at
        FROM users
        WHERE id = ANY(${accountIdArray})
        ORDER BY id
        FOR UPDATE
      `

      const buyer = accounts.find((account) => account.id === buyerUserId)

      if (!buyer || buyer.status !== 'active' || buyer.deleted_at) {
        throw new ChapterPurchaseError('ไม่พบบัญชีผู้ซื้อที่พร้อมใช้งาน', 404)
      }

      const existingPurchases = await transaction<ExistingChapterPurchase[]>`
        SELECT id
        FROM chapter_purchases
        WHERE buyer_user_id = ${buyerUserId}
          AND chapter_id = ANY(${chapterIdArray})
      `

      if (existingPurchases.length > 0) {
        throw new ChapterPurchaseError('มีบางตอนในรายการที่ซื้อแล้ว', 409)
      }

      const totalPrice = chapters.reduce(
        (total, chapter) => total + Math.round(Number(chapter.price) * 100),
        0,
      ) / 100
      if (Number(buyer.balance) < totalPrice) {
        throw new ChapterPurchaseError('ยอดเงินคงเหลือไม่เพียงพอ', 402)
      }

      const purchases: ChapterPurchase[] = []
      const writerRevenues = new Map<string, number>()

      for (const chapter of chapters) {
        const writerRevenueRate = chapter.writer_user_id === buyerUserId
          ? '0'
          : WRITER_REVENUE_RATE
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
            ROUND(${chapter.price}::NUMERIC * ${writerRevenueRate}::NUMERIC, 2),
            ${chapter.price}::NUMERIC
              - ROUND(${chapter.price}::NUMERIC * ${writerRevenueRate}::NUMERIC, 2)
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

        purchases.push(purchase)
        const currentRevenue = writerRevenues.get(chapter.writer_user_id) ?? 0
        writerRevenues.set(
          chapter.writer_user_id,
          Math.round((currentRevenue + Number(purchase.writer_revenue)) * 100) / 100,
        )
      }

      await transaction`
        UPDATE users
        SET balance = balance - ${totalPrice}::NUMERIC, updated_at = NOW()
        WHERE id = ${buyerUserId}
      `

      for (const [writerUserId, revenue] of writerRevenues) {
        if (revenue <= 0) continue
        await transaction`
          UPDATE users
          SET balance = balance + ${revenue}::NUMERIC, updated_at = NOW()
          WHERE id = ${writerUserId}
        `
      }

      return purchases
    })
  } catch (error) {
    if (error instanceof ChapterPurchaseError) throw error
    if (isUniqueViolation(error)) {
      throw new ChapterPurchaseError('คุณซื้อตอนนี้แล้ว', 409)
    }
    throw error
  }
}
