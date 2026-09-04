import { AllTimePopularSection } from '@/components/home/all-time-popular-section'
import { LatestUpdatesSection } from '@/components/home/latest-updates-section'
import { PopularSection } from '@/components/home/popular-section'
import { PopularTagsSection } from '@/components/home/popular-tags-section'
import { RisingAuthorsSection } from '@/components/home/rising-authors-section'
import { WeeklyPopularSection } from '@/components/home/weekly-popular-section'
import { getLandingStories } from '@/controllers/landing.controller'

interface HomePageProps {
  searchParams: Promise<{
    latestPage?: string | string[]
    popularPage?: string | string[]
  }>
}

function positivePage(value: string | string[] | undefined) {
  const page = typeof value === 'string' ? Number(value) : 1
  return Number.isInteger(page) && page > 0 ? page : 1
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams
  const latestPage = positivePage(params.latestPage)
  const popularPage = positivePage(params.popularPage)
  const [latest, popular] = await Promise.all([
    getLandingStories('latest', latestPage, 12),
    getLandingStories('popular', popularPage, 12),
  ])

  return (
    <div className="w-full px-4 md:px-8 lg:grid lg:grid-cols-[minmax(10rem,18rem)_minmax(0,960px)_minmax(12rem,20rem)] lg:justify-center lg:gap-4">
      <div className="hidden w-full self-start flex-col gap-4 px-3 pt-16 lg:flex">
        <PopularTagsSection />
        <RisingAuthorsSection />
      </div>
      <div className="min-w-0 w-full">
        <LatestUpdatesSection data={latest} popularPage={popularPage} />
        <PopularSection data={popular} latestPage={latestPage} />
      </div>
      <div className="hidden w-full self-start flex-col gap-4 px-3 pt-16 lg:flex">
        <WeeklyPopularSection />
        <AllTimePopularSection />
      </div>
    </div>
  )
}
