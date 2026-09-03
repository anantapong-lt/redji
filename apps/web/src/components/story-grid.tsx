'use client'

import { useState } from 'react'
import { StoryCard, type StoryCardProps } from '@/components/story-card'

interface StoryGridItem extends Omit<StoryCardProps, 'eager'> {
  id: string | number
}

export function StoryGrid({
  stories,
  eagerFirst = false,
}: {
  stories: StoryGridItem[]
  eagerFirst?: boolean
}) {
  const [visibleDesktopCount, setVisibleDesktopCount] = useState(12)
  const pages = Array.from(
    { length: Math.ceil(stories.length / 8) },
    (_, index) => stories.slice(index * 8, index * 8 + 8),
  )

  return (
    <>
      <div className="flex snap-x snap-mandatory overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-6 lg:gap-x-5 lg:gap-y-8 lg:overflow-visible lg:pb-0">
        {pages.map((page, pageIndex) => (
          <div
            key={pageIndex}
            className="grid w-full shrink-0 snap-start snap-always grid-cols-4 grid-rows-2 gap-x-2 gap-y-5 lg:contents"
          >
            {page.map(({ id, ...story }, itemIndex) => {
              const storyIndex = pageIndex * 8 + itemIndex

              return (
                <div key={id} className={storyIndex >= visibleDesktopCount ? 'min-w-0 lg:hidden' : 'min-w-0'}>
                  <StoryCard {...story} eager={eagerFirst && storyIndex === 0} />
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {visibleDesktopCount < stories.length && (
        <button
          type="button"
          onClick={() => setVisibleDesktopCount((count) => Math.min(count + 6, stories.length))}
          className="mx-auto mt-8 hidden cursor-pointer rounded-full border border-zinc-300 px-5 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-500 hover:text-zinc-950 lg:block"
        >
          แสดงเพิ่มเติม
        </button>
      )}
    </>
  )
}
