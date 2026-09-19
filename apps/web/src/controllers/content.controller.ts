import type {
  PublicChapterResponse,
  PublicMangaChapterPagesResponse,
  PublicContentResponse,
  PublicContentFavoriteResponse,
  PublicContentRatingResponse,
  PublicContentSitemapResponse,
  PublicChaptersResponse,
  PublicChapterSort,
  ChapterCommentReaction,
  ChapterCommentReactionResponse,
  ChapterCommentsResponse,
  ChapterComment,
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

export function getPublicChapter(
  slug: string,
  chapterNumber: string,
  cookieHeader?: string,
  page = 1,
  limit = 5,
): Promise<PublicChapterResponse> {
  const searchParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  return apiRequest<PublicChapterResponse>(
    `/contents/${encodeURIComponent(slug)}/chapters/${encodeURIComponent(chapterNumber)}/read?${searchParams.toString()}`,
    {
      cache: 'no-store',
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    },
  )
}

export function getPublicMangaChapterPages(
  slug: string,
  chapterNumber: string,
  page: number,
  limit: number,
  accessToken?: string | null,
): Promise<PublicMangaChapterPagesResponse> {
  const searchParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  return apiRequest<PublicMangaChapterPagesResponse>(
    `/contents/${encodeURIComponent(slug)}/chapters/${encodeURIComponent(chapterNumber)}/read/pages?${searchParams.toString()}`,
    { cache: 'no-store', accessToken },
  )
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

export function getChapterComments(
  slug: string,
  chapterNumber: string,
  accessToken?: string | null,
  page = 1,
  limit = 10,
): Promise<ChapterCommentsResponse> {
  const searchParams = new URLSearchParams({ page: String(page), limit: String(limit) })
  return apiRequest<ChapterCommentsResponse>(
    `/contents/${encodeURIComponent(slug)}/chapters/${encodeURIComponent(chapterNumber)}/comments?${searchParams.toString()}`,
    { cache: 'no-store', accessToken },
  )
}

export function createChapterComment(
  slug: string,
  chapterNumber: string,
  body: string,
  accessToken: string,
  parentCommentId?: string,
): Promise<{ comment: ChapterComment }> {
  return apiRequest(
    `/contents/${encodeURIComponent(slug)}/chapters/${encodeURIComponent(chapterNumber)}/comments`,
    {
      method: 'POST',
      accessToken,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, parent_comment_id: parentCommentId }),
    },
  )
}

export function editChapterComment(
  slug: string,
  chapterNumber: string,
  commentId: string,
  body: string,
  accessToken: string,
): Promise<{ comment: { body: string; updated_at: string } }> {
  return apiRequest(
    `/contents/${encodeURIComponent(slug)}/chapters/${encodeURIComponent(chapterNumber)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: 'PATCH',
      accessToken,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    },
  )
}

export function deleteChapterComment(
  slug: string,
  chapterNumber: string,
  commentId: string,
  accessToken: string,
): Promise<{ success: true }> {
  return apiRequest(
    `/contents/${encodeURIComponent(slug)}/chapters/${encodeURIComponent(chapterNumber)}/comments/${encodeURIComponent(commentId)}`,
    { method: 'DELETE', accessToken },
  )
}

export function setChapterCommentReaction(
  slug: string,
  chapterNumber: string,
  commentId: string,
  reaction: ChapterCommentReaction,
  accessToken: string,
): Promise<ChapterCommentReactionResponse> {
  return apiRequest(
    `/contents/${encodeURIComponent(slug)}/chapters/${encodeURIComponent(chapterNumber)}/comments/${encodeURIComponent(commentId)}/reaction`,
    {
      method: 'PUT',
      accessToken,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reaction }),
    },
  )
}

export function removeChapterCommentReaction(
  slug: string,
  chapterNumber: string,
  commentId: string,
  accessToken: string,
): Promise<ChapterCommentReactionResponse> {
  return apiRequest(
    `/contents/${encodeURIComponent(slug)}/chapters/${encodeURIComponent(chapterNumber)}/comments/${encodeURIComponent(commentId)}/reaction`,
    { method: 'DELETE', accessToken },
  )
}
