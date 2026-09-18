import { Suspense } from 'react'
import { AllTimePopularSection } from '@/components/home/all-time-popular-section'
import { LatestUpdatesSection } from '@/components/home/latest-updates-section'
import { PopularSection } from '@/components/home/popular-section'
import { PopularTagsSection } from '@/components/home/popular-tags-section'
import { RisingAuthorsSection } from '@/components/home/rising-authors-section'
import { WeeklyPopularSection } from '@/components/home/weekly-popular-section'
import { getLandingStories } from '@/controllers/landing.controller'
import { getRandomWriterProfiles } from '@/controllers/profile.controller'

async function DeferredRisingAuthorsSection() {
  const { profiles } = await getRandomWriterProfiles()

  return <RisingAuthorsSection profiles={profiles} />
}

export default async function HomePage() {
  const pageSize = 12
  const [latest, popular] = await Promise.all([
    getLandingStories('latest', 1, pageSize),
    getLandingStories('popular', 1, pageSize),
  ])
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
        <PopularSection data={popular} renderedAt={renderedAt} />
      </div>
      <div className="hidden w-full self-start flex-col gap-4 px-3 pt-16 lg:flex">
        <WeeklyPopularSection />
        <AllTimePopularSection />
      </div>
    </div>
  )
}
