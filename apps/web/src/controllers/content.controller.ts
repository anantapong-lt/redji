import type { PublicContentResponse } from '@/interface/content.interface'
import { apiRequest } from '@/lib/api-client'

export function getPublicContent(slug: string): Promise<PublicContentResponse> {
  return apiRequest<PublicContentResponse>(`/contents/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  })
}
