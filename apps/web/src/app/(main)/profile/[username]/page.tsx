import { ProfilePage } from '@/components/profile/profile-page'
import { getServerProfile } from '@/lib/server-auth'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const profile = await getServerProfile(username)
  if (!profile) notFound()

  return <ProfilePage username={username} initialProfile={profile} />
}
