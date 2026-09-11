import { apiRequest } from '@/lib/api-client'
import type { ProfileSocialLinks, UserProfile } from '@/interface/profile.interface'

export function getMyProfile(accessToken: string): Promise<{ profile: UserProfile }> {
  return apiRequest('/profiles/me', { accessToken, cache: 'no-store' })
}

export function getProfile(username: string, type: 'novel' | 'manga' = 'novel', page = 1): Promise<{ profile: UserProfile }> {
  return apiRequest(`/profiles/${encodeURIComponent(username)}?type=${type}&page=${page}&limit=12`, { cache: 'no-store' })
}

export function updateMyProfile(
  input: { bio: string; social_links: ProfileSocialLinks },
  accessToken: string,
): Promise<{ profile: UserProfile }> {
  return apiRequest('/profiles/me', {
    method: 'PATCH',
    accessToken,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function uploadMyProfileCover(file: File, accessToken: string): Promise<{ profile: UserProfile }> {
  const body = new FormData()
  body.append('cover', file)
  return apiRequest('/profiles/me/cover', { method: 'POST', accessToken, body })
}
