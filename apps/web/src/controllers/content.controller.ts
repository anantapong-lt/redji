import type {
  PublicContentResponse,
  PublicContentFavoriteResponse,
  PublicContentRatingResponse,
  PublicContentSitemapResponse,
  PublicChaptersResponse,
  PublicChapterSort,
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

export function ratePublicContent(
  slug: string,
  rating: number,
  accessToken: string,
): Promise<PublicContentRatingResponse> {
  return apiRequest<PublicContentRatingResponse>(
    `/contents/${encodeURIComponent(slug)}/rating`,
    {
      method: 'POST',
      accessToken,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating }),
    },
  )
}

export function getPublicContentChapters(
  slug: string,
  page = 1,
  limit = 25,
  sort: PublicChapterSort = 'latest',
  accessToken?: string | null,
  cookieHeader?: string,
): Promise<PublicChaptersResponse> {
  const searchParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort,
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
