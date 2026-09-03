'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StoryStatus, StoryType } from '@/constants/story.constant'
import { getMyContents } from '@/controllers/writer.controller'
import type {
  WriterContent,
  WriterContentTab,
  WriterContentsResponse,
} from '@/interface/writer-content.interface'
import { CreateContentDialog } from './create-content-dialog'
import { ChevronDownIcon, CoinsIcon, ImageIcon, PencilIcon, Trash2Icon } from 'lucide-react'

const PAGE_LIMIT = 10

const tabLabels: Record<WriterContentTab, string> = {
  novel: 'นิยาย',
  cartoon: 'การ์ตูน',
}

const typeLabels: Record<StoryType, string> = {
  [StoryType.NOVEL]: 'นิยาย',
  [StoryType.MANGA]: 'การ์ตูน',
}

const statusLabels: Record<StoryStatus, string> = {
  [StoryStatus.DRAFT]: 'ฉบับร่าง',
  [StoryStatus.ONGOING]: 'กำลังเผยแพร่',
  [StoryStatus.COMPLETED]: 'จบแล้ว',
  [StoryStatus.HIATUS]: 'หยุดชั่วคราว',
  [StoryStatus.CANCELLED]: 'ยกเลิก',
}

function statusVariant(status: StoryStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === StoryStatus.ONGOING) return 'default'
  if (status === StoryStatus.DRAFT) return 'secondary'
  if (status === StoryStatus.CANCELLED) return 'destructive'
  return 'outline'
}

function formatNumber(value: string): string {
  return new Intl.NumberFormat('th-TH').format(Number(value))
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function LatestChapter({ content }: { content: WriterContent }) {
  if (!content.latest_chapter) return <span className="text-muted-foreground">ยังไม่มีตอน</span>

  return (
    <span>
      ตอนที่ {content.latest_chapter.chapter_number}: {content.latest_chapter.title}
    </span>
  )
}

function ManageContentMenu({ contentId }: { contentId: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="shrink-0">
          จัดการ
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/writer/content/${contentId}/content`}>
            <PencilIcon />
            แก้ไข
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive">
          <Trash2Icon />
          ลบ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LoadingRows() {
  return Array.from({ length: 5 }, (_, index) => (
    <TableRow key={index}>
      {Array.from({ length: 10 }, (_, cellIndex) => (
        <TableCell key={cellIndex} className="px-4 py-4">
          <Skeleton className="h-5 w-full min-w-16" />
        </TableCell>
      ))}
    </TableRow>
  ))
}

function LoadingCards() {
  return Array.from({ length: 3 }, (_, index) => (
    <div key={index} className="space-y-4 border-b p-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <Skeleton className="h-4 w-full" />
    </div>
  ))
}

interface WriterContentsProps {
  activeTab: WriterContentTab
  page: number
}

export function WriterContents({ activeTab, page }: WriterContentsProps) {
  const router = useRouter()
  const { accessToken } = useAuth()
  const [result, setResult] = useState<WriterContentsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!accessToken) return

    let cancelled = false
    setIsLoading(true)
    setHasError(false)

    void getMyContents(activeTab, page, PAGE_LIMIT, accessToken)
      .then((nextResult) => {
        if (!cancelled) setResult(nextResult)
      })
      .catch(() => {
        if (!cancelled) setHasError(true)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, activeTab, page])

  const changeTab = (value: string) => {
    router.push(`/writer/contents?tab=${value}`)
  }

  const changePage = (nextPage: number) => {
    router.push(`/writer/contents?tab=${activeTab}&page=${nextPage}`)
  }

  const contents = result?.contents ?? []
  const pagination = result?.pagination

  return (
    <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto">
        <Tabs value={activeTab} onValueChange={changeTab} className="block">
          <div className="relative flex flex-col gap-4 lg:min-h-14 lg:block">
            <TabsList
              aria-label="ประเภทผลงาน"
              className="readji-surface mx-auto flex h-auto w-fit rounded-2xl bg-white p-1.5"
            >
              {(Object.entries(tabLabels) as [WriterContentTab, string][]).map(([value, label]) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="h-auto min-w-28 flex-none rounded-xl px-4 py-3 text-sm font-bold text-muted-foreground shadow-none hover:bg-accent hover:text-foreground sm:min-w-36 sm:px-8 sm:py-4 sm:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <CreateContentDialog defaultType={activeTab} />
          </div>

          <TabsContent
            value={activeTab}
            className="mt-6 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm"
          >
          <div className="md:hidden">
            {isLoading && <LoadingCards />}

            {!isLoading && hasError && (
              <div className="px-4 py-12 text-center text-sm text-destructive">
                ไม่สามารถโหลดผลงานได้ กรุณาลองใหม่อีกครั้ง
              </div>
            )}

            {!isLoading && !hasError && contents.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                ยังไม่มี{tabLabels[activeTab]}
              </div>
            )}

            {!isLoading && !hasError && contents.map((content) => (
              <article key={content.id} className="border-b p-4 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 font-semibold break-words">{content.title}</h2>
                  <Badge className="shrink-0" variant={statusVariant(content.status)}>
                    {statusLabels[content.status]}
                  </Badge>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="rounded-xl bg-muted/50 p-3">
                    <dt className="text-xs text-muted-foreground">จำนวนตอน</dt>
                    <dd className="mt-1 font-semibold tabular-nums">
                      {formatNumber(content.chapter_count)}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <dt className="text-xs text-muted-foreground">จำนวนเข้าชม</dt>
                    <dd className="mt-1 font-semibold tabular-nums">
                      {formatNumber(content.total_views)}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CoinsIcon className="size-3.5 text-orange-500" strokeWidth={1.8} />
                      ยอดขาย
                    </dt>
                    <dd className="mt-1 font-semibold tabular-nums">
                      {formatNumber(content.sales_count)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 space-y-1 text-sm">
                  <p className="text-xs text-muted-foreground">ตอนล่าสุด</p>
                  <p className="break-words"><LatestChapter content={content} /></p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
                  <div className="min-w-0 text-xs text-muted-foreground">
                    <p>{typeLabels[content.type]}</p>
                    <p className="mt-0.5">สร้างเมื่อ {formatDate(content.created_at)}</p>
                  </div>
                  <ManageContentMenu contentId={content.id} />
                </div>
              </article>
            ))}
          </div>

          <Table className="hidden min-w-[1080px] md:table">
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-20 px-5 py-4">ปก</TableHead>
                <TableHead className="px-5 py-4">ชื่อ</TableHead>
                <TableHead className="px-4 py-4 text-right">จำนวนตอน</TableHead>
                <TableHead className="px-4 py-4 text-right">จำนวนเข้าชม</TableHead>
                <TableHead className="px-4 py-4">
                  <span className="flex items-center justify-end gap-1">
                    <CoinsIcon className="size-4 text-orange-500" strokeWidth={1.8} />
                    ยอดขาย
                  </span>
                </TableHead>
                <TableHead className="px-4 py-4">ตอนล่าสุด</TableHead>
                <TableHead className="px-4 py-4">ประเภท</TableHead>
                <TableHead className="px-4 py-4">สถานะ</TableHead>
                <TableHead className="px-4 py-4">วันที่สร้าง</TableHead>
                <TableHead className="px-5 py-4 text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <LoadingRows />}

              {!isLoading && hasError && (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-destructive">
                    ไม่สามารถโหลดผลงานได้ กรุณาลองใหม่อีกครั้ง
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && !hasError && contents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                    ยังไม่มี{tabLabels[activeTab]}
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && !hasError && contents.map((content) => (
                <TableRow key={content.id}>
                  <TableCell className="p-0">
                    <Link
                      href={`/writer/content/${content.id}/overview`}
                      aria-label={`แก้ไข ${content.title}`}
                      className="flex px-5 py-3"
                    >
                      <div className="flex h-16 w-12 items-center justify-center overflow-hidden rounded-lg bg-muted">
                        {content.cover_url ? (
                          <img
                            src={content.cover_url}
                            alt={`ปก ${content.title}`}
                            className="size-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="size-5 text-muted-foreground" strokeWidth={1.6} />
                        )}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-72 p-0 font-semibold whitespace-normal">
                    <Link
                      href={`/writer/content/${content.id}/overview`}
                      className="block px-5 py-4 transition-colors hover:text-primary"
                    >
                      {content.title}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-4 text-right tabular-nums">
                    {formatNumber(content.chapter_count)}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-right tabular-nums">
                    {formatNumber(content.total_views)}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-right tabular-nums">
                    {formatNumber(content.sales_count)}
                  </TableCell>
                  <TableCell className="max-w-64 px-4 py-4 whitespace-normal">
                    <LatestChapter content={content} />
                  </TableCell>
                  <TableCell className="px-4 py-4">{typeLabels[content.type]}</TableCell>
                  <TableCell className="px-4 py-4">
                    <Badge variant={statusVariant(content.status)}>
                      {statusLabels[content.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-4">{formatDate(content.created_at)}</TableCell>
                  <TableCell className="px-5 py-4 text-right">
                    <ManageContentMenu contentId={content.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!isLoading && !hasError && pagination && (
            <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                ทั้งหมด {new Intl.NumberFormat('th-TH').format(pagination.total)} รายการ
              </p>
              <div className="flex items-center justify-between gap-2 sm:justify-start">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => changePage(pagination.page - 1)}
                >
                  ก่อนหน้า
                </Button>
                <span className="min-w-20 text-center text-sm text-muted-foreground">
                  {pagination.page} / {Math.max(pagination.totalPages, 1)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => changePage(pagination.page + 1)}
                >
                  ถัดไป
                </Button>
              </div>
            </div>
          )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
