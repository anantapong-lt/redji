import { GenreOptionsInitializer } from '@/components/genre-options-initializer'
import { redirect } from 'next/navigation'
import { userRole } from '@/interface/user.interface'
import { getServerAuthUser } from '@/lib/server-auth'
import { WriterLayout } from './home/components/writer-layout'

export default async function WriterRootLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerAuthUser()

  if (!user) redirect('/login?next=/writer')
  if (user.role !== userRole.WRITER) redirect('/')

  return (
    <WriterLayout user={user}>
      <GenreOptionsInitializer />
      {children}
    </WriterLayout>
  )
}
