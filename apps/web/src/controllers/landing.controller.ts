import type { LandingResponse, LandingSection } from '@/interface/landing.interface'
import { apiRequest } from '@/lib/api-client'

export function getLandingStories(
  section: LandingSection,
  page: number,
  limit: number,
  signal?: AbortSignal,
): Promise<LandingResponse> {
  const searchParams = new URLSearchParams({
    section,
    page: String(page),
    limit: String(limit),
  })

  return apiRequest<LandingResponse>(`/landing?${searchParams.toString()}`, {
    next: { revalidate: 60 },
    signal,
  })
}
