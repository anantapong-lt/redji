import { apiRequest } from '@/lib/api-client'
import type { StoryType } from '@/constants/story.constant'
import type { WriterStats } from '@/interface/writer-stats.interface'

export function getWriterStats(accessToken: string): Promise<{ stats: WriterStats }> {
  return apiRequest<{ stats: WriterStats }>('/writer/stats', {
    headers: { Authorization: `Bearer ${accessToken}` },
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
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  })
}
