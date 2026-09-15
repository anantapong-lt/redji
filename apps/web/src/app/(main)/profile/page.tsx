import { ProfilePage } from '@/components/profile/profile-page'
import { getServerAccountSecurity, getServerAuthUser, getServerProfile } from '@/lib/server-auth'
import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function MyProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const user = await getServerAuthUser()
  if (!user) redirect(tab === 'security' ? '/login?next=%2Fprofile%3Ftab%3Dsecurity' : '/login?next=%2Fprofile')

  const [profile, accountSecurity] = await Promise.all([
    getServerProfile(user.username),
    tab === 'security' ? getServerAccountSecurity() : Promise.resolve(null),
  ])
  if (!profile) notFound()

  return <ProfilePage initialProfile={profile} initialIsOwnProfile initialTab={tab === 'security' ? 'security' : 'profile'} initialAccountSecurity={accountSecurity} />
}
