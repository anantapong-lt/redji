import { ContentEditor } from './components/content-editor'

type ContentType = 'novel' | 'cartoon'

interface CreateContentPageProps {
  searchParams: Promise<{
    type?: string | string[]
    title?: string | string[]
  }>
}

export default async function CreateContentPage({ searchParams }: CreateContentPageProps) {
  const params = await searchParams
  const contentType: ContentType = params.type === 'cartoon' ? 'cartoon' : 'novel'
  const initialTitle = typeof params.title === 'string' ? params.title : ''

  return <ContentEditor initialContentType={contentType} initialTitle={initialTitle} />
}
