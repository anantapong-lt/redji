import { redirect } from 'next/navigation'
import { getServerAuthUser } from '@/lib/server-auth'
import { Notifications } from './notifications'

export default async function NotificationsPage() {
  const user = await getServerAuthUser()
  if (!user) redirect('/login')

  return <Notifications />
}
