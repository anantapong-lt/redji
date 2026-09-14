import { ProfilePage } from '@/components/profile/profile-page'
import { getServerAuthUser, getServerProfile } from '@/lib/server-auth'
import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function MyProfilePage() {
  const user = await getServerAuthUser()
  if (!user) redirect('/login?next=/profile')

  const profile = await getServerProfile(user.username)
  if (!profile) notFound()

  return <ProfilePage initialProfile={profile} />
}
