import { apiRequest } from '@/lib/api-client'
import type { WriterStats } from '@/interface/writer-stats.interface'

export function getWriterStats(accessToken: string): Promise<{ stats: WriterStats }> {
  return apiRequest<{ stats: WriterStats }>('/writer/stats', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export function uploadWriterCover(
  file: File,
  accessToken: string,
): Promise<{ key: string; cover_url: string }> {
  const body = new FormData()
  body.append('file', file)

  return apiRequest<{ key: string; cover_url: string }>('/writer/contents/cover', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  })
}
