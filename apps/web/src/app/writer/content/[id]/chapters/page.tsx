import { WriterChapters } from './writer-chapters'

interface ContentChaptersPageProps {
  params: Promise<{ id: string }>
}

export default async function ContentChaptersPage({ params }: ContentChaptersPageProps) {
  const { id } = await params

  return <WriterChapters contentId={id} />
}
