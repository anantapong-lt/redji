'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { StoryGrid, type StoryGridItem } from '@/components/story-grid'
import { getLandingStories } from '@/controllers/landing.controller'
import type {
  LandingResponse,
  LandingSection,
  LandingStory,
} from '@/interface/landing.interface'

function formatChapterNumber(value: string) {
  return Number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 })
}

function formatUpdatedAt(value: string, renderedAt: number) {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((renderedAt - new Date(value).getTime()) / 1000),
  )
  if (elapsedSeconds < 60) return `${elapsedSeconds} วินาทีที่แล้ว`

  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  if (elapsedMinutes < 60) return `${elapsedMinutes} นาทีที่แล้ว`

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours} ชั่วโมงที่แล้ว`

  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value))
}

function toStoryGridItem(
  story: LandingStory,
  section: LandingSection,
  renderedAt: number,
): StoryGridItem {
  return {
    id: story.id,
    slug: story.slug,
    title: story.title,
    episode: `ตอนที่ ${formatChapterNumber(story.latest_chapter.chapter_number)}`,
    author: story.author.display_name,
    image: story.cover_url ?? '/placeholder.svg',
    blurDataUrl: story.cover_blur_data_url,
    type: story.type,
    meta: section === 'latest'
      ? `อัปเดตเมื่อ ${formatUpdatedAt(story.latest_chapter.published_at, renderedAt)}`
      : `${Number(story.total_views).toLocaleString('th-TH')} อ่าน`,
  }
}

export function LandingStoryGrid({
  initialData,
  renderedAt,
}: {
  initialData: LandingResponse
  renderedAt: number
}) {
  const [stories, setStories] = useState(initialData.stories)
  const [pagination, setPagination] = useState(initialData.pagination)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const isLoadingRef = useRef(false)

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !pagination.hasNextPage) return

    isLoadingRef.current = true
    setIsLoadingMore(true)
    setLoadError(false)

    try {
      const nextData = await getLandingStories(
        initialData.section,
        pagination.page + 1,
        pagination.limit,
      )
      setStories((current) => {
        const existingIds = new Set(current.map((story) => story.id))
        return [
          ...current,
          ...nextData.stories.filter((story) => !existingIds.has(story.id)),
        ]
      })
      setPagination(nextData.pagination)
    } catch {
      setLoadError(true)
    } finally {
      isLoadingRef.current = false
      setIsLoadingMore(false)
    }
  }, [initialData.section, pagination.hasNextPage, pagination.limit, pagination.page])

  const gridStories = useMemo(
    () => stories.map((story) => toStoryGridItem(story, initialData.section, renderedAt)),
    [initialData.section, renderedAt, stories],
  )

  return (
    <>
      <StoryGrid
        eagerFirst
        stories={gridStories}
        hasMore={pagination.hasNextPage}
        isLoadingMore={isLoadingMore}
        skeletonCount={isLoadingMore ? pagination.limit : 0}
        onLoadMore={loadMore}
      />
      {loadError ? (
        <p className="mt-3 text-center text-sm text-destructive">
          โหลดข้อมูลเพิ่มเติมไม่สำเร็จ กรุณาลองใหม่
        </p>
      ) : null}
    </>
  )
}
