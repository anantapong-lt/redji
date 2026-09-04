import type {
  PublicContentResponse,
  PublicContentFavoriteResponse,
  PublicContentSitemapResponse,
  PublicChaptersResponse,
} from '@/interface/content.interface'
import { apiRequest } from '@/lib/api-client'

export function getPublicContent(
  slug: string,
  cookieHeader?: string,
): Promise<PublicContentResponse> {
  return apiRequest<PublicContentResponse>(`/contents/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  })
}

export function favoritePublicContent(
  slug: string,
  accessToken: string,
): Promise<PublicContentFavoriteResponse> {
  return apiRequest<PublicContentFavoriteResponse>(
    `/contents/${encodeURIComponent(slug)}/favorite`,
    { method: 'POST', accessToken },
  )
}

export function unfavoritePublicContent(
  slug: string,
  accessToken: string,
): Promise<PublicContentFavoriteResponse> {
  return apiRequest<PublicContentFavoriteResponse>(
    `/contents/${encodeURIComponent(slug)}/favorite`,
    { method: 'DELETE', accessToken },
  )
}

export function getPublicContentChapters(
  slug: string,
  page = 1,
  limit = 25,
  accessToken?: string | null,
  cookieHeader?: string,
): Promise<PublicChaptersResponse> {
  const searchParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })

  return apiRequest<PublicChaptersResponse>(
    `/contents/${encodeURIComponent(slug)}/chapters?${searchParams.toString()}`,
    {
      cache: 'no-store',
      accessToken,
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    },
  )
}

export function getPublicContentSitemap(): Promise<PublicContentSitemapResponse> {
  return apiRequest<PublicContentSitemapResponse>('/contents', {
    cache: 'no-store',
  })
}
