import type { LandingResponse, LandingSection } from '@/interface/landing.interface'
import type { StoryType } from '@/constants/story.constant'
import { apiRequest } from '@/lib/api-client'

export function getLandingStories(
  section: LandingSection,
  page: number,
  limit: number,
  signal?: AbortSignal,
  category?: string,
  search?: string,
  contentType?: StoryType,
): Promise<LandingResponse> {
  const searchParams = new URLSearchParams({
    section,
    page: String(page),
    limit: String(limit),
  })
  if (category) searchParams.set('category', category)
  if (search) searchParams.set('search', search)
  if (contentType) searchParams.set('type', contentType)

  return apiRequest<LandingResponse>(`/landing?${searchParams.toString()}`, {
    next: { revalidate: 60 },
    signal,
  })
}
