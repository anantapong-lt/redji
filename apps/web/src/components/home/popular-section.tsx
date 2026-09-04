import { LandingStoryGrid } from '@/components/home/landing-story-grid'
import type { LandingResponse } from '@/interface/landing.interface'

interface PopularSectionProps {
  data: LandingResponse
  renderedAt: number
}

export function PopularSection({
  data,
  renderedAt,
}: PopularSectionProps) {
  return (
    <section
      aria-labelledby="popular-heading"
      className="rounded-3xl pt-2 pb-8 md:pb-10"
    >
      <h2 id="popular-heading" className="mb-6 text-xl font-bold tracking-tight text-zinc-950 md:text-2xl">
        ยอดนิยม
      </h2>

      <LandingStoryGrid initialData={data} renderedAt={renderedAt} />
    </section>
  )
}
