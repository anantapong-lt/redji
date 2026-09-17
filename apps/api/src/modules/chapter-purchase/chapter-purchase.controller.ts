import {
  ChapterPurchaseError,
  findUserChapterPurchaseHistory,
  purchaseChapter,
  purchaseChapters,
} from './chapter-purchase.service'
import type { chapterPurchaseHistoryQuerySchema } from './chapter-purchase.schema'

function purchaseErrorResponse(error: unknown) {
  if (error instanceof ChapterPurchaseError) {
    return Response.json({ message: error.message }, { status: error.statusCode })
  }

  console.error('Unable to purchase chapters', error)
  return Response.json(
    { message: 'ไม่สามารถซื้อตอนได้ กรุณาลองใหม่อีกครั้ง' },
    { status: 500 },
  )
}

export async function purchasePublicChapter(currentUserId: string, chapterId: string) {
  try {
    const purchase = await purchaseChapter(currentUserId, chapterId)
    return Response.json({ purchase }, { status: 201 })
  } catch (error) {
    return purchaseErrorResponse(error)
  }
}

export async function purchasePublicChapters(currentUserId: string, chapterIds: string[]) {
  try {
    const purchases = await purchaseChapters(currentUserId, chapterIds)
    return Response.json({ purchases }, { status: 201 })
  } catch (error) {
    return purchaseErrorResponse(error)
  }
}

export async function getUserChapterPurchaseHistory(
  currentUserId: string,
  query: typeof chapterPurchaseHistoryQuerySchema.static,
) {
  try {
    return await findUserChapterPurchaseHistory(currentUserId, query.page ?? 1, query.limit ?? 10)
  } catch (error) {
    console.error('Unable to load chapter purchase history', error)
    return Response.json(
      { message: 'ไม่สามารถโหลดประวัติการซื้อตอนได้ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 },
    )
  }
}
