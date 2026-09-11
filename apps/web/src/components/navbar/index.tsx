import { getServerAuthUser, getServerUnreadNotificationCount, type PublicFeatureConfig } from '@/lib/server-auth'
import { NavbarClient } from './navbar-client'

export async function Navbar({ features }: { features: PublicFeatureConfig | null }) {
  const user = await getServerAuthUser()
  const unreadNotificationCount = user ? await getServerUnreadNotificationCount() : 0

  return <NavbarClient initialUser={user} initialUnreadNotificationCount={unreadNotificationCount} features={features} />
}
