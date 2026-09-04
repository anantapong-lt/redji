'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeftIcon, CoinsIcon, PlusIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth/auth-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  bulkUpdateWriterChapterPrice,
  bulkUpdateWriterChapterStatus,
  getWriterChapters,
} from '@/controllers/writer.controller'
import type {
  ChapterStatus,
  WriterChaptersResponse,
} from '@/interface/writer-chapter.interface'

const PAGE_LIMIT = 10

const statusOptions: { value: ChapterStatus; label: string }[] = [
  { value: 'draft', label: 'ฉบับร่าง' },
  { value: 'scheduled', label: 'ตั้งเวลาเผยแพร่' },
  { value: 'published', label: 'เผยแพร่แล้ว' },
  { value: 'hidden', label: 'ซ่อน' },
]

const statusLabels = Object.fromEntries(
  statusOptions.map(({ value, label }) => [value, label]),
) as Record<ChapterStatus, string>

function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatPrice(value: string): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function formatChapterNumber(value: string): string {
  const [integerPart, decimalPart] = value.split('.')
  const significantDecimal = decimalPart?.replace(/0+$/, '')
  return significantDecimal ? `${integerPart}.${significantDecimal}` : integerPart
}

function statusVariant(status: ChapterStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'published') return 'default'
  if (status === 'draft') return 'secondary'
  if (status === 'hidden') return 'destructive'
  return 'outline'
}

function LoadingRows() {
  return Array.from({ length: 5 }, (_, rowIndex) => (
    <TableRow key={rowIndex}>
      {Array.from({ length: 9 }, (_, cellIndex) => (
        <TableCell key={cellIndex} className="px-4 py-4">
          <Skeleton className="h-5 w-full min-w-12" />
        </TableCell>
      ))}
    </TableRow>
  ))
}

interface WriterChaptersProps {
  contentId: string
}

export function WriterChapters({ contentId }: WriterChaptersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { accessToken } = useAuth()
  const search = searchParams.get('search')?.trim() ?? ''
  const requestedPage = Number(searchParams.get('page') ?? 1)
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const [searchInput, setSearchInput] = useState(search)
  const [result, setResult] = useState<WriterChaptersResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkPrice, setBulkPrice] = useState('')
  const [bulkStatus, setBulkStatus] = useState<ChapterStatus | ''>('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const updateUrl = useCallback((
    nextSearch: string,
    nextPage: number,
    replace = false,
  ) => {
    const params = new URLSearchParams()
    if (nextSearch) params.set('search', nextSearch)
    if (nextPage > 1) params.set('page', String(nextPage))
    const query = params.toString()
    const href = `/writer/content/${contentId}/chapters${query ? `?${query}` : ''}`

    if (replace) router.replace(href)
    else router.push(href)
  }, [contentId, router])

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  useEffect(() => {
    const nextSearch = searchInput.trim()
    if (nextSearch === search) return

    const timeoutId = window.setTimeout(() => {
      updateUrl(nextSearch, 1, true)
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [search, searchInput, updateUrl])

  useEffect(() => {
    if (!accessToken) return

    let cancelled = false
    setIsLoading(true)
    setLoadError(null)

    void getWriterChapters(contentId, search, page, PAGE_LIMIT, accessToken)
      .then((nextResult) => {
        if (!cancelled) {
          setResult(nextResult)
          setSelectedIds(new Set())
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'ไม่สามารถโหลดรายการตอนได้')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, contentId, page, reloadKey, search])

  const chapters = result?.chapters ?? []
  const pagination = result?.pagination
  const allVisibleSelected = chapters.length > 0
    && chapters.every((chapter) => selectedIds.has(chapter.id))

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    updateUrl(searchInput.trim(), 1)
  }

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      if (allVisibleSelected) return new Set()
      return new Set(chapters.map((chapter) => chapter.id))
    })
  }

  const toggleChapter = (chapterId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(chapterId)) next.delete(chapterId)
      else next.add(chapterId)
      return next
    })
  }

  const handleBulkPrice = async () => {
    const price = Number(bulkPrice)
    if (!accessToken || selectedIds.size === 0 || bulkPrice.trim() === '' || price < 0) return

    setIsUpdating(true)
    try {
      const { updated_count: updatedCount } = await bulkUpdateWriterChapterPrice(
        contentId,
        [...selectedIds],
        price,
        accessToken,
      )
      toast.success(`อัปเดตราคา ${updatedCount} ตอนเรียบร้อยแล้ว`)
      setBulkPrice('')
      setReloadKey((current) => current + 1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ไม่สามารถอัปเดตราคาตอนได้')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleBulkStatus = async () => {
    if (!accessToken || selectedIds.size === 0 || !bulkStatus) return

    let publishedAt: string | undefined
    if (bulkStatus === 'scheduled') {
      const date = new Date(scheduledAt)
      if (!scheduledAt || Number.isNaN(date.getTime())) {
        toast.error('กรุณาระบุวันและเวลาเผยแพร่')
        return
      }
      publishedAt = date.toISOString()
    }

    setIsUpdating(true)
    try {
      const { updated_count: updatedCount } = await bulkUpdateWriterChapterStatus(
        contentId,
        [...selectedIds],
        bulkStatus,
        publishedAt,
        accessToken,
      )
      toast.success(`อัปเดตสถานะ ${updatedCount} ตอนเรียบร้อยแล้ว`)
      setBulkStatus('')
      setScheduledAt('')
      setReloadKey((current) => current + 1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ไม่สามารถอัปเดตสถานะตอนได้')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="outline" className="h-11 w-fit self-start rounded-xl">
          <Link href="/writer/contents">
            <ArrowLeftIcon />
            ย้อนกลับ
          </Link>
        </Button>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <form onSubmit={handleSearch} className="relative w-full sm:w-80">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="ค้นหาเลขตอนหรือชื่อตอน"
              aria-label="ค้นหาเลขตอนหรือชื่อตอน"
              className="h-11 rounded-xl bg-white pl-9"
            />
          </form>
          <Button asChild className="h-11 rounded-xl px-5 font-bold">
            <Link href={`/writer/content/${contentId}/chapters/create`}>
              <PlusIcon />
              สร้างตอน
            </Link>
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="readji-surface flex flex-col gap-3 rounded-xl p-4">
          <p className="text-sm font-semibold">เลือกแล้ว {selectedIds.size} ตอน</p>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={bulkPrice}
                onChange={(event) => setBulkPrice(event.target.value)}
                placeholder="ราคา (0 = ฟรี)"
                aria-label="ราคาที่ต้องการอัปเดต"
                className="h-10 rounded-xl"
              />
              <Button
                type="button"
                variant="outline"
                disabled={isUpdating || bulkPrice.trim() === '' || Number(bulkPrice) < 0}
                onClick={handleBulkPrice}
                className="h-10 rounded-xl"
              >
                อัปเดตราคา
              </Button>
            </div>

            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <Select
                value={bulkStatus}
                onValueChange={(value) => setBulkStatus(value as ChapterStatus)}
              >
                <SelectTrigger className="h-10! w-full rounded-xl">
                  <SelectValue placeholder="เลือกสถานะ" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bulkStatus === 'scheduled' && (
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                  aria-label="วันและเวลาเผยแพร่"
                  className="h-10 rounded-xl"
                />
              )}
              <Button
                type="button"
                variant="outline"
                disabled={isUpdating || !bulkStatus || (bulkStatus === 'scheduled' && !scheduledAt)}
                onClick={handleBulkStatus}
                className="h-10 rounded-xl"
              >
                อัปเดตสถานะ
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <Table className="min-w-[1120px]">
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-12 px-4 text-center">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="เลือกตอนทั้งหมดในหน้านี้"
                  className="size-4 accent-primary"
                />
              </TableHead>
              <TableHead className="px-4">ตอนที่</TableHead>
              <TableHead className="px-4">ชื่อตอน</TableHead>
              <TableHead className="px-4 text-right">ราคา</TableHead>
              <TableHead className="px-4 text-right">ยอดขาย</TableHead>
              <TableHead className="px-4">สถานะ</TableHead>
              <TableHead className="px-4">เผยแพร่เมื่อ</TableHead>
              <TableHead className="px-4">สร้างเมื่อ</TableHead>
              <TableHead className="px-4 text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <LoadingRows />}

            {!isLoading && loadError && (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-destructive">
                  {loadError}
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !loadError && chapters.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                  {search ? 'ไม่พบตอนที่ค้นหา' : 'ยังไม่มีตอน'}
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !loadError && chapters.map((chapter) => (
              <TableRow key={chapter.id} data-state={selectedIds.has(chapter.id) ? 'selected' : undefined}>
                <TableCell className="px-4 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(chapter.id)}
                    onChange={() => toggleChapter(chapter.id)}
                    aria-label={`เลือกตอนที่ ${chapter.chapter_number}`}
                    className="size-4 accent-primary"
                  />
                </TableCell>
                <TableCell className="px-4 font-semibold tabular-nums">
                  {formatChapterNumber(chapter.chapter_number)}
                </TableCell>
                <TableCell className="max-w-72 px-4 whitespace-normal">{chapter.title}</TableCell>
                <TableCell className="px-4 text-right tabular-nums">
                  {chapter.is_free ? (
                    <span className="font-semibold text-primary">ฟรี</span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <CoinsIcon className="size-4 text-orange-500" />
                      {formatPrice(chapter.price)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="px-4 text-right tabular-nums">
                  {new Intl.NumberFormat('th-TH').format(Number(chapter.sales_count))}
                </TableCell>
                <TableCell className="px-4">
                  <Badge variant={statusVariant(chapter.status)}>
                    {statusLabels[chapter.status]}
                  </Badge>
                </TableCell>
                <TableCell className="px-4">{formatDate(chapter.published_at)}</TableCell>
                <TableCell className="px-4">{formatDate(chapter.created_at)}</TableCell>
                <TableCell className="px-4 text-right">
                  <Button type="button" variant="outline" size="sm">จัดการ</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {!isLoading && !loadError && pagination && (
          <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              ทั้งหมด {new Intl.NumberFormat('th-TH').format(pagination.total)} ตอน
            </p>
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => updateUrl(search, pagination.page - 1)}
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
                onClick={() => updateUrl(search, pagination.page + 1)}
              >
                ถัดไป
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
