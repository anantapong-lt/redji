import { SectionPagination } from '@/components/home/section-pagination'
import { StoryGrid } from '@/components/story-grid'
import type { LandingResponse } from '@/interface/landing.interface'

function formatChapterNumber(value: string) {
  return Number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 })
}

function formatUpdatedAt(value: string) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (elapsedSeconds < 60) return `${elapsedSeconds} วินาทีที่แล้ว`

  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  if (elapsedMinutes < 60) return `${elapsedMinutes} นาทีที่แล้ว`

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours} ชั่วโมงที่แล้ว`

  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value))
}

export function LatestUpdatesSection({
  data,
  popularPage,
}: {
  data: LandingResponse
  popularPage: number
}) {
  return (
    <section
      aria-labelledby="latest-updates-heading"
      className="mt-8 rounded-3xl pt-8 pb-2 md:pt-10"
    >
      <h2 id="latest-updates-heading" className="mb-6 text-xl font-bold tracking-tight text-zinc-950 md:text-2xl">
        อัปเดตใหม่
      </h2>

      <StoryGrid
        eagerFirst
        stories={data.stories.map((story) => ({
          id: story.id,
          title: story.title,
          episode: `ตอนที่ ${formatChapterNumber(story.latest_chapter.chapter_number)}`,
          author: story.author.display_name,
          image: story.cover_url ?? '/placeholder.svg',
          type: story.type,
          meta: `อัปเดตเมื่อ ${formatUpdatedAt(story.latest_chapter.published_at)}`,
        }))}
      />

      <SectionPagination
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        pageParam="latestPage"
        otherPage={popularPage}
        otherPageParam="popularPage"
      />
    </section>
  )
}
