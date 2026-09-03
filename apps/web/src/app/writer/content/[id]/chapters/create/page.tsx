import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CreateChapterPageProps {
  params: Promise<{ id: string }>
}

export default async function CreateChapterPage({ params }: CreateChapterPageProps) {
  const { id } = await params

  return (
    <section className="mt-6">
      <Button asChild variant="outline" className="h-11 rounded-xl">
        <Link href={`/writer/content/${id}/chapters`}>
          <ArrowLeftIcon />
          ย้อนกลับ
        </Link>
      </Button>
    </section>
  )
}
