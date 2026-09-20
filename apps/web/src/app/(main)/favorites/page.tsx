import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { FavoritesPage } from './favorites-page'
import { getServerAuthUser, getServerFavoriteStories } from '@/lib/server-auth'

export const metadata: Metadata = {
  title: 'ชั้นหนังสือส่วนตัว',
  description: 'รวมนิยายและการ์ตูนที่คุณติดตาม',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function MyFavoritesPage() {
  const user = await getServerAuthUser()
  if (!user) redirect('/login?next=/favorites')

  const [novels, manga] = await Promise.all([
    getServerFavoriteStories('novel'),
    getServerFavoriteStories('manga'),
  ])

  const emptyResult = {
    stories: [],
    pagination: { page: 1, limit: 12, has_next_page: false },
  }

  return (
    <FavoritesPage
      initialNovels={novels ?? emptyResult}
      initialManga={manga ?? emptyResult}
    />
  )
}
