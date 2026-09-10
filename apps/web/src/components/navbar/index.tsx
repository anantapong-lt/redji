import { getServerAuthUser, getServerUnreadNotificationCount } from '@/lib/server-auth'
import { NavbarClient } from './navbar-client'

export async function Navbar() {
  const user = await getServerAuthUser()
  const unreadNotificationCount = user ? await getServerUnreadNotificationCount() : 0

  return <NavbarClient initialUser={user} initialUnreadNotificationCount={unreadNotificationCount} />
}
