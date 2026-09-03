import { apiRequest } from '@/lib/api-client'
import type { StoryType } from '@/constants/story.constant'
import type {
  WriterContentDetail,
  WriterContentTab,
  WriterContentsResponse,
} from '@/interface/writer-content.interface'
import type { WriterStats } from '@/interface/writer-stats.interface'
import type {
  ChapterStatus,
  WriterChaptersResponse,
} from '@/interface/writer-chapter.interface'

export function getWriterStats(accessToken: string): Promise<{ stats: WriterStats }> {
  return apiRequest<{ stats: WriterStats }>('/writer/stats', {
    accessToken,
  })
}

export function getMyContents(
  tab: WriterContentTab,
  page: number,
  limit: number,
  accessToken: string,
): Promise<WriterContentsResponse> {
  const searchParams = new URLSearchParams({
    tab,
    page: String(page),
    limit: String(limit),
  })

  return apiRequest(`/writer/contents?${searchParams.toString()}`, {
    accessToken,
  })
}

export function createWriterContent(
  body: FormData,
  accessToken: string,
): Promise<{
  story: {
    id: string
    type: StoryType
    slug: string
    cover_url: string | null
  }
}> {
  return apiRequest('/writer/contents', {
    method: 'POST',
    accessToken,
    body,
  })
}

export function getWriterContent(
  contentId: string,
  accessToken: string,
): Promise<{ story: WriterContentDetail }> {
  return apiRequest(`/writer/contents/${contentId}`, {
    accessToken,
  })
}

export function updateWriterContent(
  contentId: string,
  body: FormData,
  accessToken: string,
): Promise<{
  story: {
    id: string
    type: StoryType
    slug: string
    cover_url: string | null
  }
}> {
  return apiRequest(`/writer/contents/${contentId}`, {
    method: 'PATCH',
    accessToken,
    body,
  })
}

export function getWriterChapters(
  contentId: string,
  search: string,
  page: number,
  limit: number,
  accessToken: string,
): Promise<WriterChaptersResponse> {
  const searchParams = new URLSearchParams({
    search,
    page: String(page),
    limit: String(limit),
  })

  return apiRequest(`/writer/contents/${contentId}/chapters?${searchParams.toString()}`, {
    accessToken,
  })
}

export function bulkUpdateWriterChapterPrice(
  contentId: string,
  chapterIds: string[],
  price: number,
  accessToken: string,
): Promise<{ updated_count: number }> {
  return apiRequest(`/writer/contents/${contentId}/chapters/bulk-price`, {
    method: 'PATCH',
    accessToken,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chapter_ids: chapterIds, price }),
  })
}

export function bulkUpdateWriterChapterStatus(
  contentId: string,
  chapterIds: string[],
  status: ChapterStatus,
  publishedAt: string | undefined,
  accessToken: string,
): Promise<{ updated_count: number }> {
  return apiRequest(`/writer/contents/${contentId}/chapters/bulk-status`, {
    method: 'PATCH',
    accessToken,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chapter_ids: chapterIds,
      status,
      ...(publishedAt ? { published_at: publishedAt } : {}),
    }),
  })
}
