import { WriterOverview } from './writer-overview'

export default async function ContentOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <WriterOverview contentId={id} />
}
