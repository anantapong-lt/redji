import type { WriterContentTab } from '@/interface/writer-content.interface'
import { WriterContents } from './components/writer-contents'

interface WriterContentsPageProps {
  searchParams: Promise<{
    tab?: string | string[]
    page?: string | string[]
  }>
}

export default async function WriterContentsPage({ searchParams }: WriterContentsPageProps) {
  const params = await searchParams
  const activeTab: WriterContentTab = params.tab === 'cartoon' ? 'cartoon' : 'novel'
  const requestedPage = typeof params.page === 'string' ? Number(params.page) : 1
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1

  return <WriterContents activeTab={activeTab} page={page} />
}
