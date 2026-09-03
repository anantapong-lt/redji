import { ContentEditor } from '../../create/components/content-editor'

interface EditContentPageProps {
  params: Promise<{ id: string }>
}

export default async function EditContentPage({ params }: EditContentPageProps) {
  const { id } = await params

  return <ContentEditor contentId={id} />
}
