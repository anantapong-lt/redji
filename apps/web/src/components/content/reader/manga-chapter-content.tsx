'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getPublicMangaChapterPages } from '@/controllers/content.controller'
import type { PublicMangaChapterPage } from '@/interface/content.interface'

interface MangaPagePagination {
  page: number
  limit: number
  total: number
  has_next_page: boolean
}

export function MangaChapterContent({
  storyTitle,
  slug,
  chapterNumber,
  initialPages,
  initialPagination,
}: {
  storyTitle: string
  slug: string
  chapterNumber: string
  initialPages: PublicMangaChapterPage[]
  initialPagination: MangaPagePagination
}) {
  const isDev = process.env.NODE_ENV === 'development'
  const [pages, setPages] = useState(initialPages)
  const [pagination, setPagination] = useState(initialPagination)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const loadingRef = useRef(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (!pagination.has_next_page || loadingRef.current) return

    loadingRef.current = true
    setIsLoading(true)
    setLoadError(null)
    try {
      const response = await getPublicMangaChapterPages(
        slug,
        String(Number(chapterNumber)),
        pagination.page + 1,
        pagination.limit,
      )
      setPages((current) => {
        const knownIds = new Set(current.map((page) => page.id))
        return [...current, ...response.pages.filter((page) => !knownIds.has(page.id))]
      })
      setPagination(response.pagination)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'ไม่สามารถโหลดภาพถัดไปได้')
    } finally {
      loadingRef.current = false
      setIsLoading(false)
    }
  }, [chapterNumber, pagination, slug])

  useEffect(() => {
    const target = loadMoreRef.current
    if (!target || !pagination.has_next_page) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      { rootMargin: '1200px 0px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [loadMore, pagination.has_next_page])

  return (
    <article className="bg-card px-0 py-8 sm:px-8 sm:py-12">
      <p className="mb-8 px-4 text-center text-xs text-muted-foreground/60">
        เรื่อง: {storyTitle}
      </p>
      <div
        className="mx-auto flex max-w-3xl select-none flex-col"
        onContextMenu={isDev ? undefined : (event) => event.preventDefault()}
        onCopy={isDev ? undefined : (event) => event.preventDefault()}
      >
        {pages.map((page) => (
          <img
            key={page.id}
            src={page.image_url}
            alt={page.alt_text ?? `หน้า ${page.page_number}`}
            width={page.width ?? undefined}
            height={page.height ?? undefined}
            loading={page.page_number === 1 ? 'eager' : 'lazy'}
            draggable={isDev}
            className="h-auto w-full"
          />
        ))}
      </div>

      {pagination.has_next_page ? <div ref={loadMoreRef} className="h-px" /> : null}
      {isLoading ? <p className="mt-4 text-center text-sm text-muted-foreground">กำลังโหลดภาพถัดไป...</p> : null}
      {loadError ? (
        <div className="mt-4 flex flex-col items-center gap-2 text-sm text-destructive">
          <p>{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadMore()}>
            ลองใหม่
          </Button>
        </div>
      ) : null}
    </article>
  )
}
