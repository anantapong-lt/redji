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

async function DeferredLatestUpdatesSection() {
  const data = await getLandingStories('latest', 1, PAGE_SIZE)

  return <LatestUpdatesSection data={data} renderedAt={Date.now()} />
}

async function DeferredPopularSection() {
  const data = await getLandingStories('popular', 1, PAGE_SIZE)

  return <PopularSection data={data} renderedAt={Date.now()} />
}

function StorySectionSkeleton({ latest = false }: { latest?: boolean }) {
  return (
    <section
      aria-busy="true"
      aria-label={latest ? 'กำลังโหลดอัปเดตใหม่' : 'กำลังโหลดยอดนิยม'}
      className={latest
        ? 'mt-5 rounded-3xl pt-8 pb-2 md:pt-10'
        : 'rounded-3xl pt-2 pb-8 md:pb-10'}
    >
      <h2 className={`${latest ? 'mb-3' : 'mb-6'} text-xl font-bold tracking-tight text-zinc-950 md:text-2xl`}>
        {latest ? 'อัปเดตใหม่' : 'ยอดนิยม'}
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

export default function HomePage() {
  return (
    <div className="w-full px-4 md:px-8 lg:grid lg:grid-cols-[minmax(10rem,18rem)_minmax(0,80rem)_minmax(12rem,20rem)] lg:justify-center lg:gap-4">
      <div className="hidden w-full self-start flex-col gap-4 px-3 pt-16 lg:flex">
        <PopularTagsSection />
        <Suspense fallback={null}>
          <DeferredRisingAuthorsSection />
        </Suspense>
      </div>
      <div className="mx-auto min-w-0 w-full max-w-7xl">
        <Suspense fallback={<StorySectionSkeleton latest />}>
          <DeferredLatestUpdatesSection />
        </Suspense>
        <Suspense fallback={<StorySectionSkeleton />}>
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
