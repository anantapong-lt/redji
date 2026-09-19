'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, FileText, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getApiUrl } from '@/site.config'

type WriterAgreement = {
  id: string
  version: number
  content_html: string
}

export default function WriterTermsPage() {
  const [agreement, setAgreement] = useState<WriterAgreement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAgreement = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(getApiUrl('/agreements/writer'), {
        credentials: 'include',
        signal,
      })
      if (!response.ok) throw new Error('ไม่สามารถโหลดข้อกำหนดการใช้งานได้')

      const body = await response.json() as { agreement: WriterAgreement | null }
      setAgreement(body.agreement)
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setAgreement(null)
      setError('ไม่สามารถโหลดข้อกำหนดการใช้งานได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadAgreement(controller.signal)
    return () => controller.abort()
  }, [loadAgreement])

  return (
    <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="size-5" strokeWidth={1.8} />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.025em] md:text-3xl">ข้อกำหนดการใช้งาน</h1>
            <p className="mt-1 text-sm text-muted-foreground">ข้อกำหนดและเงื่อนไขสำหรับนักเขียน</p>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border bg-background p-5 shadow-sm sm:p-8">
          {isLoading ? (
            <div className="space-y-4" aria-label="กำลังโหลดข้อกำหนดการใช้งาน">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : error ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <AlertCircle className="size-10 text-destructive" strokeWidth={1.6} />
              <p className="mt-3 text-sm text-destructive">{error}</p>
              <Button className="mt-4" variant="outline" onClick={() => void loadAgreement()}>
                <RefreshCw className="size-4" />
                ลองใหม่
              </Button>
            </div>
          ) : agreement ? (
            <>
              <p className="mb-5 text-xs text-muted-foreground">เวอร์ชัน {agreement.version}</p>
              <div
                className="break-words text-sm leading-7 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/35 [&_blockquote]:pl-4 [&_h1]:my-5 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:my-4 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:my-3 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
                dangerouslySetInnerHTML={{ __html: agreement.content_html }}
              />
            </>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <FileText className="size-10 text-muted-foreground" strokeWidth={1.6} />
              <p className="mt-3 text-sm text-muted-foreground">ยังไม่มีข้อกำหนดสำหรับนักเขียนที่เปิดใช้งาน</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
