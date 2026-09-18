import { Suspense } from 'react'
import { AllTimePopularSection } from '@/components/home/all-time-popular-section'
import { LatestUpdatesSection } from '@/components/home/latest-updates-section'
import { PopularSection } from '@/components/home/popular-section'
import { PopularTagsSection } from '@/components/home/popular-tags-section'
import { RisingAuthorsSection } from '@/components/home/rising-authors-section'
import { WeeklyPopularSection } from '@/components/home/weekly-popular-section'
import { Skeleton } from '@/components/ui/skeleton'
import { getLandingStories } from '@/controllers/landing.controller'
import { getRandomWriterProfiles } from '@/controllers/profile.controller'

const PAGE_SIZE = 12

async function DeferredPopularSection() {
  const data = await getLandingStories('popular', 1, PAGE_SIZE)

  return <PopularSection data={data} renderedAt={Date.now()} />
}

function PopularSectionSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="กำลังโหลดยอดนิยม"
      className="rounded-3xl pt-2 pb-8 md:pb-10"
    >
      <h2 className="mb-6 text-xl font-bold tracking-tight text-zinc-950 md:text-2xl">
        ยอดนิยม
      </h2>
      <div aria-hidden="true" className="mx-auto grid grid-cols-3 gap-x-2 gap-y-5 pb-2 lg:max-w-7xl lg:grid-cols-5 lg:gap-x-4 lg:gap-y-7 lg:pb-0 2xl:grid-cols-6">
        {Array.from({ length: PAGE_SIZE }, (_, index) => (
          <div key={index} className={`${index >= 6 ? 'hidden lg:block' : ''} min-w-0 overflow-hidden rounded-md border border-border/80 bg-card`}>
            <Skeleton className="aspect-[3/4] rounded-none" />
            <div className="p-3">
              <Skeleton className="h-5" />
              <Skeleton className="mt-1 h-4 w-3/4" />
              <Skeleton className="mt-1 h-3.5" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

async function DeferredRisingAuthorsSection() {
  const { profiles } = await getRandomWriterProfiles()

  return <RisingAuthorsSection profiles={profiles} />
}

export default async function HomePage() {
  // Keep the LCP covers in the initial HTML, outside streamed placeholders.
  const latest = await getLandingStories('latest', 1, PAGE_SIZE)
  const renderedAt = Date.now()

  return (
    <div className="w-full px-4 md:px-8 lg:grid lg:grid-cols-[minmax(10rem,18rem)_minmax(0,80rem)_minmax(12rem,20rem)] lg:justify-center lg:gap-4">
      <div className="hidden w-full self-start flex-col gap-4 px-3 pt-16 lg:flex">
        <PopularTagsSection />
        <Suspense fallback={null}>
          <DeferredRisingAuthorsSection />
        </Suspense>
      </div>
      <div className="mx-auto min-w-0 w-full max-w-7xl">
        <LatestUpdatesSection data={latest} renderedAt={renderedAt} />
        <Suspense fallback={<PopularSectionSkeleton />}>
          <DeferredPopularSection />
        </Suspense>
      </div>
      <div className="hidden w-full self-start flex-col gap-4 px-3 pt-16 lg:flex">
        <WeeklyPopularSection />
        <AllTimePopularSection />
      </div>
    </div>
  )
}
