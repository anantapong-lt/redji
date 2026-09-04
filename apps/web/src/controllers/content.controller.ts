import type {
  PublicContentResponse,
  PublicContentSitemapResponse,
  PublicChaptersResponse,
} from '@/interface/content.interface'
import { apiRequest } from '@/lib/api-client'

export function getPublicContent(slug: string): Promise<PublicContentResponse> {
  return apiRequest<PublicContentResponse>(`/contents/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  })
}

export function getPublicContentChapters(
  slug: string,
  page = 1,
  limit = 25,
  accessToken?: string | null,
): Promise<PublicChaptersResponse> {
  const searchParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })

  return apiRequest<PublicChaptersResponse>(
    `/contents/${encodeURIComponent(slug)}/chapters?${searchParams.toString()}`,
    { cache: 'no-store', accessToken },
  )
}

export function getPublicContentSitemap(): Promise<PublicContentSitemapResponse> {
  return apiRequest<PublicContentSitemapResponse>('/contents', {
    cache: 'no-store',
  })
}
