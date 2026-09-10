import { getServerAuthUser, getServerUnreadNotificationCount } from '@/lib/server-auth'
import { NavbarClient } from './navbar-client'

export async function Navbar() {
  const [user, unreadNotificationCount] = await Promise.all([
    getServerAuthUser(),
    getServerUnreadNotificationCount(),
  ])

  return <NavbarClient initialUser={user} initialUnreadNotificationCount={unreadNotificationCount} />
}
