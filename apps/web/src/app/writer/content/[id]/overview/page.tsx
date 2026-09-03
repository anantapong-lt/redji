import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ContentOverviewPage() {
  return (
    <section className="mt-6">
      <Button asChild variant="outline" className="h-11 w-fit rounded-xl">
        <Link href="/writer/contents">
          <ArrowLeftIcon />
          ย้อนกลับ
        </Link>
      </Button>
    </section>
  )
}
