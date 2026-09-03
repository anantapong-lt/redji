import { ContentEditor } from '../../../contents/create/components/content-editor'

interface ContentDetailsPageProps {
  params: Promise<{ id: string }>
}

export default async function ContentDetailsPage({ params }: ContentDetailsPageProps) {
  const { id } = await params

  return <ContentEditor contentId={id} embedded />
}
