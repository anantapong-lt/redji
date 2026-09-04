import type {
  BulkChapterPurchaseResponse,
  ChapterPurchaseResponse,
} from '@/interface/chapter-purchase.interface'
import { apiRequest } from '@/lib/api-client'

export function purchaseChapter(
  chapterId: string,
  accessToken: string,
): Promise<ChapterPurchaseResponse> {
  return apiRequest<ChapterPurchaseResponse>(
    `/chapters/${encodeURIComponent(chapterId)}/purchase`,
    { method: 'POST', accessToken },
  )
}

export function purchaseChapters(
  chapterIds: string[],
  accessToken: string,
): Promise<BulkChapterPurchaseResponse> {
  return apiRequest<BulkChapterPurchaseResponse>('/chapters/purchase', {
    method: 'POST',
    accessToken,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chapter_ids: chapterIds }),
  })
}
