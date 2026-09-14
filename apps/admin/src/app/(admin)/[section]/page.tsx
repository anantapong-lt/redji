import { notFound } from 'next/navigation'

export default async function EmptyAdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  if (section === 'history') notFound()

  return null
}
