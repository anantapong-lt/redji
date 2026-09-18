'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StoryGrid, type StoryGridItem } from '@/components/story-grid'
import { getLandingStories } from '@/controllers/landing.controller'
import type {
  LandingResponse,
  LandingSection,
  LandingStory,
} from '@/interface/landing.interface'
import { formatChapterNumber } from '@/utils/chapter-number.util'

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
    ratingAverage: Number(story.rating_average),
    meta: section === 'latest'
      ? `${formatUpdatedAt(story.latest_chapter.published_at, renderedAt)}`
      : section === 'most-followed'
        ? `${Number(story.favorite_count).toLocaleString('th-TH')} ติดตาม`
      : `${Number(story.total_views).toLocaleString('th-TH')} อ่าน`,
  }
}

export function StoryResultsGrid({
  initialData,
  renderedAt,
  categories,
  search,
  contentType,
  mobileInfiniteScroll = false,
}: {
  initialData: LandingResponse
  renderedAt: number
  categories?: string[]
  search?: string
  contentType?: import('@/constants/story.constant').StoryType
  mobileInfiniteScroll?: boolean
}) {
  const [stories, setStories] = useState(initialData.stories)
  const [pagination, setPagination] = useState(initialData.pagination)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const isLoadingRef = useRef(false)
  const requestVersionRef = useRef(0)

  useEffect(() => {
    requestVersionRef.current += 1
    isLoadingRef.current = false
    setStories(initialData.stories)
    setPagination(initialData.pagination)
    setIsLoadingMore(false)
    setLoadError(false)
  }, [initialData])

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !pagination.hasNextPage) return

    isLoadingRef.current = true
    const requestVersion = requestVersionRef.current
    setIsLoadingMore(true)
    setLoadError(false)

    try {
      const nextData = await getLandingStories(
        initialData.section,
        pagination.page + 1,
        pagination.limit,
        undefined,
        categories,
        search,
        contentType,
      )
      if (requestVersion !== requestVersionRef.current) return
      setStories((current) => {
        const existingIds = new Set(current.map((story) => story.id))
        return [
          ...current,
          ...nextData.stories.filter((story) => !existingIds.has(story.id)),
        ]
      })
      setPagination(nextData.pagination)
    } catch {
      if (requestVersion === requestVersionRef.current) setLoadError(true)
    } finally {
      if (requestVersion === requestVersionRef.current) {
        isLoadingRef.current = false
        setIsLoadingMore(false)
      }
    }
  }, [categories, contentType, initialData.section, pagination.hasNextPage, pagination.limit, pagination.page, search])

  const gridStories = useMemo(
    () => stories.map((story) => toStoryGridItem(story, initialData.section, renderedAt)),
    [initialData.section, renderedAt, stories],
  )

  return (
    <>
      <StoryGrid
        eagerFirst={initialData.section === 'latest'}
        stories={gridStories}
        hasMore={pagination.hasNextPage}
        isLoadingMore={isLoadingMore}
        skeletonCount={isLoadingMore ? pagination.limit : 0}
        onLoadMore={loadMore}
        mobileLayout={mobileInfiniteScroll ? 'grid' : 'carousel'}
      />
      {loadError ? (
        <p className="mt-3 text-center text-sm text-destructive">
          โหลดข้อมูลเพิ่มเติมไม่สำเร็จ กรุณาลองใหม่
        </p>
      ) : null}
    </>
  )
}
