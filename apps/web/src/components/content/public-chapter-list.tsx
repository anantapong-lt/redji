'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { GiTwoCoins } from 'react-icons/gi'
import { useAuth } from '@/components/auth/auth-provider'
import { getPublicContentChapters } from '@/controllers/content.controller'
import type { PublicChaptersResponse } from '@/interface/content.interface'

function formatChapterNumber(value: string) {
  return Number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 })
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

function sortByChapterNumber<T extends { chapter_number: string }>(chapters: T[]) {
  return [...chapters].sort(
    (first, second) => Number(second.chapter_number) - Number(first.chapter_number),
  )
}

export function PublicChapterList({
  slug,
  initialData,
  renderedAt,
}: {
  slug: string
  initialData: PublicChaptersResponse
  renderedAt: number
}) {
  const { accessToken, status } = useAuth()
  const [chapters, setChapters] = useState(() => sortByChapterNumber(initialData.chapters))
  const [pagination, setPagination] = useState(initialData.pagination)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      setChapters((current) => current.map((chapter) => ({
        ...chapter,
        is_purchased: false,
        is_owner: false,
        can_read: chapter.is_free,
      })))
      return
    }

    if (status !== 'authenticated' || !accessToken) return

    let cancelled = false
    void getPublicContentChapters(slug, 1, initialData.pagination.limit, accessToken)
      .then((authorizedData) => {
        if (cancelled) return

        const authorizedById = new Map(
          authorizedData.chapters.map((chapter) => [chapter.id, chapter]),
        )
        setChapters((current) => current.map(
          (chapter) => authorizedById.get(chapter.id) ?? chapter,
        ))
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [accessToken, initialData.pagination.limit, slug, status])

  async function loadMore() {
    if (isLoading || !pagination.hasNextPage) return

    setIsLoading(true)
    setLoadError(false)

    try {
      const nextData = await getPublicContentChapters(
        slug,
        pagination.page + 1,
        pagination.limit,
        accessToken,
      )
      setChapters((current) => {
        const existingIds = new Set(current.map((chapter) => chapter.id))
        return sortByChapterNumber([
          ...current,
          ...nextData.chapters.filter((chapter) => !existingIds.has(chapter.id)),
        ])
      })
      setPagination(nextData.pagination)
    } catch {
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section
      aria-labelledby="chapter-list-heading"
      className="readji-surface mt-5 overflow-hidden rounded-[1.75rem]"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border/70 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="h-6 w-1 rounded-full bg-primary" />
          <h2 id="chapter-list-heading" className="text-lg font-extrabold text-foreground">
            รายการตอน
          </h2>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">
          {pagination.total.toLocaleString('th-TH')} ตอน
        </span>
      </div>

      {chapters.length > 0 ? (
        <ol className="divide-y divide-border/70">
          {chapters.map((chapter) => (
            <li
              key={chapter.id}
              className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-accent/80 sm:px-6"
            >
              <span className="flex min-w-10 shrink-0 items-center justify-center rounded-xl bg-secondary px-2 py-2.5 text-xs font-extrabold tabular-nums text-secondary-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                {formatChapterNumber(chapter.chapter_number)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                  {chapter.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatRelativeDate(chapter.published_at, renderedAt)}
                </p>
              </div>
              {!chapter.can_read ? (
                <span
                  aria-label={`${Number(chapter.price).toLocaleString('th-TH')} เบรี`}
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary"
                >
                  {Number(chapter.price).toLocaleString('th-TH')}
                  <GiTwoCoins
                    className="size-4 text-amber-500 drop-shadow-[0_1px_0_rgb(180_83_9_/_0.45)]"
                    aria-hidden="true"
                  />
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          ยังไม่มีตอนที่เผยแพร่
        </p>
      )}

      {pagination.hasNextPage || loadError ? (
        <div className="border-t border-border/70 px-4 py-4 text-center sm:px-6">
          {loadError ? (
            <p className="mb-3 text-sm text-destructive">
              โหลดรายการตอนเพิ่มเติมไม่สำเร็จ กรุณาลองใหม่
            </p>
          ) : null}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void loadMore()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-primary/25 bg-card px-5 py-2 text-sm font-bold text-primary transition-all hover:-translate-y-0.5 hover:bg-primary hover:text-primary-foreground hover:shadow-sm disabled:cursor-wait disabled:opacity-60"
          >
            {isLoading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {isLoading ? 'กำลังโหลด...' : 'แสดงเพิ่มเติม'}
          </button>
        </div>
      ) : null}
    </section>
  )
}
