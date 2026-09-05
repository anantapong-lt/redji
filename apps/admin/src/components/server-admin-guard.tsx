import { redirect } from 'next/navigation'
import { getServerAdminUser } from '@/lib/server-auth'

export async function ServerAdminGuard({ children }: { children: React.ReactNode }) {
  const user = await getServerAdminUser()
  if (!user) redirect('/login')

  return children
}
