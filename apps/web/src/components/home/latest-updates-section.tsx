import { LandingStoryGrid } from '@/components/home/landing-story-grid'
import type { LandingResponse } from '@/interface/landing.interface'

export function LatestUpdatesSection({
  data,
  renderedAt,
}: {
  data: LandingResponse
  renderedAt: number
}) {
  return (
    <section
      aria-labelledby="latest-updates-heading"
      className="mt-5 rounded-3xl pt-8 pb-2 md:pt-10"
    >
      <h2 id="latest-updates-heading" className="mb-3 text-xl font-bold tracking-tight text-zinc-950 md:text-2xl">
        อัปเดตใหม่
      </h2>

      <LandingStoryGrid initialData={data} renderedAt={renderedAt} />
    </section>
  )
}
