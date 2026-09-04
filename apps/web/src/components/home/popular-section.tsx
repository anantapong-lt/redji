import { SectionPagination } from '@/components/home/section-pagination'
import { StoryGrid } from '@/components/story-grid'
import type { LandingResponse } from '@/interface/landing.interface'

function formatChapterNumber(value: string) {
  return Number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 })
}

function formatViews(value: string) {
  return `${Number(value).toLocaleString('th-TH')} อ่าน`
}

export function PopularSection({
  data,
  latestPage,
}: {
  data: LandingResponse
  latestPage: number
}) {
  return (
    <section
      aria-labelledby="popular-heading"
      className="rounded-3xl pt-2 pb-8 md:pb-10"
    >
      <h2 id="popular-heading" className="mb-6 text-xl font-bold tracking-tight text-zinc-950 md:text-2xl">
        ยอดนิยม
      </h2>

      <StoryGrid
        stories={data.stories.map((story) => ({
          id: story.id,
          title: story.title,
          episode: `ตอนที่ ${formatChapterNumber(story.latest_chapter.chapter_number)}`,
          author: story.author.display_name,
          image: story.cover_url ?? '/placeholder.svg',
          type: story.type,
          meta: formatViews(story.total_views),
        }))}
      />

      <SectionPagination
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        pageParam="popularPage"
        otherPage={latestPage}
        otherPageParam="latestPage"
      />
    </section>
  )
}
