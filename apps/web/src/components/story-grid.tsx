'use client'

import type { UIEventHandler } from 'react'
import { StoryCard, type StoryCardProps } from '@/components/common/story-card'
import { StoryCardSkeleton } from '@/components/common/story-card-skeleton'

export interface StoryGridItem extends Omit<StoryCardProps, 'eager'> {
  id: string | number
}

export function StoryGrid({
  stories,
  eagerFirst = false,
  hasMore = false,
  isLoadingMore = false,
  skeletonCount = 0,
  onLoadMore,
}: {
  stories: StoryGridItem[]
  eagerFirst?: boolean
  hasMore?: boolean
  isLoadingMore?: boolean
  skeletonCount?: number
  onLoadMore?: () => Promise<void>
}) {
  const items: Array<StoryGridItem | null> = [
    ...stories,
    ...Array.from({ length: skeletonCount }, () => null),
  ]
  const pages = Array.from(
    { length: Math.ceil(items.length / 8) },
    (_, index) => items.slice(index * 8, index * 8 + 8),
  )
  const handleScroll: UIEventHandler<HTMLDivElement> = (event) => {
    if (!hasMore || isLoadingMore || !onLoadMore) return

    const container = event.currentTarget
    const remainingScroll = container.scrollWidth - container.scrollLeft - container.clientWidth
    if (remainingScroll <= 48) void onLoadMore()
  }
  const handleLoadMoreClick = async () => {
    if (hasMore && onLoadMore) await onLoadMore()
  }

  return (
    <>
      <div
        onScroll={handleScroll}
        className="mx-auto flex snap-x snap-mandatory overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:max-w-[960px] lg:grid-cols-5 lg:gap-x-4 lg:gap-y-7 lg:overflow-visible lg:pb-0 2xl:grid-cols-6"
      >
        {pages.map((page, pageIndex) => (
          <div
            key={pageIndex}
            className={`grid w-full shrink-0 snap-start snap-always grid-cols-4 gap-x-2 gap-y-5 lg:contents ${
              page.length > 4 ? 'grid-rows-2' : 'grid-rows-1'
            }`}
          >
            {page.map((item, itemIndex) => {
              const storyIndex = pageIndex * 8 + itemIndex

              if (!item) {
                return (
                  <div key={`skeleton-${storyIndex}`} className="min-w-0">
                    <StoryCardSkeleton />
                  </div>
                )
              }

              const { id, ...story } = item

              return (
                <div key={id} className="min-w-0">
                  <StoryCard {...story} eager={eagerFirst && storyIndex === 0} />
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {hasMore ? (
        <button
          type="button"
          disabled={isLoadingMore}
          onClick={() => void handleLoadMoreClick()}
          className="mx-auto mt-8 hidden cursor-pointer rounded-full border border-zinc-300 px-5 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-500 hover:text-zinc-950 disabled:cursor-wait disabled:opacity-60 lg:block"
        >
          {isLoadingMore ? 'กำลังโหลด...' : 'แสดงเพิ่มเติม'}
        </button>
      ) : null}
    </>
  )
}
