import WriterChapterPage from '../../create/page'

interface EditChapterPageProps {
  params: Promise<{ id: string; chapterId: string }>
}

export default function EditChapterPage({ params }: EditChapterPageProps) {
  return <WriterChapterPage params={params} />
}
