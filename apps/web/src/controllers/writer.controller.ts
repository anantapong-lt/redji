import { apiRequest } from '@/lib/api-client'
import type { StoryType } from '@/constants/story.constant'
import type {
  WriterContentTab,
  WriterContentsResponse,
} from '@/interface/writer-content.interface'
import type { WriterStats } from '@/interface/writer-stats.interface'

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
