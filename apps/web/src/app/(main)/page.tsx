import { AllTimePopularSection } from '@/components/home/all-time-popular-section'
import { LatestUpdatesSection } from '@/components/home/latest-updates-section'
import { PopularSection } from '@/components/home/popular-section'
import { PopularTagsSection } from '@/components/home/popular-tags-section'
import { RisingAuthorsSection } from '@/components/home/rising-authors-section'
import { WeeklyPopularSection } from '@/components/home/weekly-popular-section'

export default function HomePage() {
  return (
    <div className="w-full px-4 md:px-8 lg:grid lg:grid-cols-[minmax(10rem,18rem)_minmax(0,960px)_minmax(12rem,20rem)] lg:justify-center lg:gap-4">
      <div className="hidden w-full self-start flex-col gap-4 px-3 pt-16 lg:flex">
        <PopularTagsSection />
        <RisingAuthorsSection />
      </div>
      <div className="min-w-0 w-full">
        <LatestUpdatesSection />
        <PopularSection />
      </div>
      <div className="hidden w-full self-start flex-col gap-4 px-3 pt-16 lg:flex">
        <WeeklyPopularSection />
        <AllTimePopularSection />
      </div>
    </div>
  )
}
