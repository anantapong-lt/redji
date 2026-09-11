import { findMyProfile, findPublicProfileByUsername, findRandomWriterProfiles, updateMyProfile, updateMyProfileAvatar, updateMyProfileCover } from './profiles.service'

export async function getRandomWriterProfilesResponse(limit?: number) {
  return { profiles: await findRandomWriterProfiles(limit ?? 5) }
}

export async function getMyProfileResponse(userId: string) {
  const profile = await findMyProfile(userId)
  return profile ? { profile } : Response.json({ message: 'ไม่พบโปรไฟล์' }, { status: 404 })
}

export async function getPublicProfileResponse(username: string, type?: 'novel' | 'manga', page?: number, limit?: number) {
  const profile = await findPublicProfileByUsername(username, type ?? 'novel', page ?? 1, limit ?? 12)
  return profile ? { profile } : Response.json({ message: 'ไม่พบโปรไฟล์' }, { status: 404 })
}

export async function updateMyProfileResponse(
  userId: string,
  input: { bio?: string | null; social_links?: Record<string, string | undefined> },
) {
  const profile = await updateMyProfile(userId, input)
  return profile ? { profile } : Response.json({ message: 'ไม่พบโปรไฟล์' }, { status: 404 })
}

export async function updateMyProfileCoverResponse(userId: string, cover: File) {
  const profile = await updateMyProfileCover(userId, cover)
  return profile ? { profile } : Response.json({ message: 'ไม่พบโปรไฟล์' }, { status: 404 })
}

export async function updateMyProfileAvatarResponse(userId: string, avatar: File) {
  const profile = await updateMyProfileAvatar(userId, avatar)
  return profile ? { profile } : Response.json({ message: 'ไม่พบโปรไฟล์' }, { status: 404 })
}
