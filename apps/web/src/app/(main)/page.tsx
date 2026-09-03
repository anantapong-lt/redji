import { LatestUpdatesSection } from '@/components/home/latest-updates-section'
import { PopularSection } from '@/components/home/popular-section'
import { WeeklyPopularSection } from '@/components/home/weekly-popular-section'

export default function HomePage() {
  return (
    <div className="w-full px-4 md:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-4 lg:pr-0">
      <div className="mx-auto min-w-0 w-full max-w-[1280px]">
        <LatestUpdatesSection />
        <PopularSection />
      </div>
      <WeeklyPopularSection />
    </div>
  )
}
