import { getServerAuthUser } from '@/lib/server-auth'
import { NavbarClient } from './navbar-client'

export async function Navbar() {
  const user = await getServerAuthUser()

  return <NavbarClient initialUser={user} />
}
