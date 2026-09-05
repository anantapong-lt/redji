'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpDown } from 'lucide-react'
import { GiTwoCoins } from 'react-icons/gi'
import { useAuth } from '@/components/auth/auth-provider'
import { ChapterPurchaseDialog } from '@/components/content/chapter-purchase-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getPublicContentChapters } from '@/controllers/content.controller'
import type {
  PublicChapter,
  PublicChapterSort,
  PublicChaptersResponse,
} from '@/interface/content.interface'
import { SITE_CONFIG } from '@/site.config'

function formatChapterNumber(value: string) {
  return Number(value).toLocaleString('th-TH', { maximumFractionDigits: 1 })
}

function formatRelativeDate(value: string, referenceTime: number) {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((referenceTime - new Date(value).getTime()) / 1000),
  )
  if (elapsedSeconds < 60) return 'เมื่อสักครู่'

  const minutes = Math.floor(elapsedSeconds / 60)
  if (minutes < 60) return `${minutes.toLocaleString('th-TH')} นาทีที่แล้ว`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours.toLocaleString('th-TH')} ชม.ที่แล้ว`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days.toLocaleString('th-TH')} วันที่แล้ว`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months.toLocaleString('th-TH')} เดือนที่แล้ว`

  const years = Math.floor(days / 365)
  return `${years.toLocaleString('th-TH')} ปีที่แล้ว`
}

function getPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const items: Array<number | 'ellipsis-start' | 'ellipsis-end'> = [1]
  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)

  if (start > 2) items.push('ellipsis-start')
  for (let page = start; page <= end; page += 1) items.push(page)
  if (end < totalPages - 1) items.push('ellipsis-end')
  items.push(totalPages)

  return items
}

export function PublicChapterList({
  slug,
  storyTitle,
  coverUrl,
  initialData,
  renderedAt,
}: {
  slug: string
  storyTitle: string
  coverUrl: string | null
  initialData: PublicChaptersResponse
  renderedAt: number
}) {
  const router = useRouter()
  const { accessToken, status } = useAuth()
  const [chapters, setChapters] = useState(initialData.chapters)
  const [pagination, setPagination] = useState(initialData.pagination)
  const [sort, setSort] = useState<PublicChapterSort>('latest')
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([])
  const [purchaseDialogChapters, setPurchaseDialogChapters] = useState<PublicChapter[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const purchasableChapters = chapters.filter((chapter) => !chapter.can_read)
  const selectedChapters = purchasableChapters.filter((chapter) => (
    selectedChapterIds.includes(chapter.id)
  ))
  const allPurchasableSelected = purchasableChapters.length > 0
    && selectedChapters.length === purchasableChapters.length

  useEffect(() => {
    if (status === 'unauthenticated') {
      setChapters((current) => current.map((chapter) => ({
        ...chapter,
        is_purchased: false,
        is_owner: false,
        can_read: chapter.is_free,
      })))
    }
  }, [status])

  async function loadPage(page: number, nextSort: PublicChapterSort = sort) {
    if (
      isLoading
      || (page === pagination.page && nextSort === sort)
      || page < 1
      || page > pagination.totalPages
    ) return

    setIsLoading(true)
    setLoadError(false)

    try {
      const nextData = await getPublicContentChapters(
        slug,
        page,
        pagination.limit,
        nextSort,
        accessToken,
      )
      setChapters(nextData.chapters)
      setSelectedChapterIds([])
      setPurchaseDialogChapters([])
      setPagination(nextData.pagination)
      setSort(nextSort)
    } catch {
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }

  function markChaptersAsPurchased(chapterIds: string[]) {
    const purchasedIds = new Set(chapterIds)
    const purchasedChapter = purchaseDialogChapters.length === 1
      && purchasedIds.has(purchaseDialogChapters[0].id)
      ? purchaseDialogChapters[0]
      : null
    setChapters((current) => current.map((chapter) => (
      purchasedIds.has(chapter.id)
        ? { ...chapter, is_purchased: true, can_read: true }
        : chapter
    )))
    setSelectedChapterIds([])
    setPurchaseDialogChapters([])

    if (purchasedChapter) {
      router.push(
        `/content/${encodeURIComponent(slug)}/${encodeURIComponent(String(Number(purchasedChapter.chapter_number)))}`,
      )
    }
  }

  function toggleChapterSelection(chapterId: string) {
    setSelectedChapterIds((current) => (
      current.includes(chapterId)
        ? current.filter((id) => id !== chapterId)
        : [...current, chapterId]
    ))
  }

  function toggleAllPurchasable() {
    setSelectedChapterIds(
      allPurchasableSelected
        ? []
        : purchasableChapters.map((chapter) => chapter.id),
    )
  }

  return (
    <section
      aria-labelledby="chapter-list-heading"
      className="readji-surface mt-5 overflow-hidden rounded-[1.75rem]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="h-6 w-1 rounded-full bg-primary" />
          <h2 id="chapter-list-heading" className="text-lg font-extrabold text-foreground">
            รายการตอน
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground">
            {pagination.total.toLocaleString('th-TH')} ตอน
          </span>
          <Select
            value={sort}
            disabled={isLoading}
            onValueChange={(value) => void loadPage(1, value as PublicChapterSort)}
          >
            <SelectTrigger
              size="sm"
              aria-label="เรียงรายการตอน"
              className="w-[11.5rem] bg-card"
            >
              <ArrowUpDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                <SelectItem value="latest">ล่าสุด</SelectItem>
                <SelectItem value="oldest">เก่าสุด</SelectItem>
                <SelectItem value="chapter_asc">
                  เรียงตามตอน น้อยไปมาก
                </SelectItem>
                <SelectItem value="chapter_desc">
                  เรียงตามตอน มากไปน้อย
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {purchasableChapters.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/25 px-4 py-3 sm:px-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Checkbox
              checked={allPurchasableSelected
                ? true
                : selectedChapters.length > 0
                  ? 'indeterminate'
                  : false}
              onCheckedChange={toggleAllPurchasable}
              className="cursor-pointer"
            />
            เลือกทั้งหมดในหน้านี้
          </label>
          <button
            type="button"
            disabled={selectedChapters.length === 0}
            onClick={() => setPurchaseDialogChapters(selectedChapters)}
            className="h-9 cursor-pointer rounded-full bg-primary px-4 text-sm font-extrabold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            ซื้อที่เลือก ({selectedChapters.length.toLocaleString('th-TH')})
          </button>
        </div>
      ) : null}

      {chapters.length > 0 ? (
        <ol className="divide-y divide-border/70">
          {chapters.map((chapter) => (
            <li
              key={chapter.id}
              className="group flex items-center transition-colors duration-200 hover:bg-accent/80"
            >
              {!chapter.can_read ? (
                <Checkbox
                  checked={selectedChapterIds.includes(chapter.id)}
                  onCheckedChange={() => toggleChapterSelection(chapter.id)}
                  aria-label={`เลือกซื้อตอนที่ ${formatChapterNumber(chapter.chapter_number)}`}
                  className="ml-4 cursor-pointer sm:ml-6"
                />
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (chapter.can_read) {
                    router.push(
                      `/content/${encodeURIComponent(slug)}/${encodeURIComponent(String(Number(chapter.chapter_number)))}`,
                    )
                  } else {
                    setPurchaseDialogChapters([chapter])
                  }
                }}
                className={`flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-3 text-left ${
                  chapter.can_read ? 'px-4 sm:px-6' : 'pr-4 pl-3 sm:pr-6'
                }`}
              >
                <span className="flex min-w-10 shrink-0 items-center justify-center rounded-xl bg-secondary px-2 py-2.5 text-xs font-extrabold tabular-nums text-secondary-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  {formatChapterNumber(chapter.chapter_number)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                    {chapter.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {formatRelativeDate(chapter.published_at, renderedAt)}
                  </span>
                </span>
                {!chapter.can_read ? (
                  <span
                    aria-label={`${Number(chapter.price).toLocaleString('th-TH')} ${SITE_CONFIG.coinName}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary"
                  >
                    {Number(chapter.price).toLocaleString('th-TH')}
                    <GiTwoCoins
                      className="size-4 text-amber-500 drop-shadow-[0_1px_0_rgb(180_83_9_/_0.45)]"
                      aria-hidden="true"
                    />
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          ยังไม่มีตอนที่เผยแพร่
        </p>
      )}

      {pagination.totalPages > 1 || loadError ? (
        <div className="border-t border-border/70 px-4 py-4 text-center sm:px-6">
          {loadError ? (
            <p className="mb-3 text-sm text-destructive">
              โหลดรายการตอนเพิ่มเติมไม่สำเร็จ กรุณาลองใหม่
            </p>
          ) : null}
          <nav aria-label="หน้ารายการตอน" className="flex flex-wrap items-center justify-center gap-1.5">
            <button
              type="button"
              disabled={isLoading || !pagination.hasPreviousPage}
              onClick={() => void loadPage(pagination.page - 1)}
              className="h-9 cursor-pointer rounded-lg border border-border bg-card px-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/45 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              ก่อนหน้า
            </button>

            {getPaginationItems(pagination.page, pagination.totalPages).map((item) => (
              typeof item === 'number' ? (
                <button
                  key={item}
                  type="button"
                  disabled={isLoading || item === pagination.page}
                  onClick={() => void loadPage(item)}
                  aria-current={item === pagination.page ? 'page' : undefined}
                  className="size-9 cursor-pointer rounded-lg border border-border bg-card text-sm font-bold text-muted-foreground transition-colors hover:border-primary/45 hover:text-primary disabled:cursor-default aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
                >
                  {item.toLocaleString('th-TH')}
                </button>
              ) : (
                <span key={item} className="flex size-9 items-center justify-center text-muted-foreground">
                  …
                </span>
              )
            ))}

            <button
              type="button"
              disabled={isLoading || !pagination.hasNextPage}
              onClick={() => void loadPage(pagination.page + 1)}
              className="h-9 cursor-pointer rounded-lg border border-border bg-card px-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/45 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              ถัดไป
            </button>

          </nav>
        </div>
      ) : null}
      <ChapterPurchaseDialog
        chapters={purchaseDialogChapters}
        storyTitle={storyTitle}
        coverUrl={coverUrl}
        open={purchaseDialogChapters.length > 0}
        onOpenChange={(open) => {
          if (!open) setPurchaseDialogChapters([])
        }}
        onPurchased={markChaptersAsPurchased}
      />
    </section>
  )
}
