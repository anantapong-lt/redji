import type { LandingResponse, LandingSection } from '@/interface/landing.interface'
import { apiRequest } from '@/lib/api-client'

export function getLandingStories(
  section: LandingSection,
  page: number,
  limit: number,
): Promise<LandingResponse> {
  const searchParams = new URLSearchParams({
    section,
    page: String(page),
    limit: String(limit),
  })

  return apiRequest<LandingResponse>(`/landing?${searchParams.toString()}`, {
    cache: 'no-store',
  })
}
