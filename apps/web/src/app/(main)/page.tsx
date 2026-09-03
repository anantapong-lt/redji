import { AllTimePopularSection } from '@/components/home/all-time-popular-section'
import { LatestUpdatesSection } from '@/components/home/latest-updates-section'
import { PopularSection } from '@/components/home/popular-section'
import { WeeklyPopularSection } from '@/components/home/weekly-popular-section'

export default function HomePage() {
  return (
    <div className="w-full px-4 md:px-8 lg:grid lg:grid-cols-[minmax(10rem,1fr)_minmax(0,960px)_minmax(10rem,1fr)] lg:gap-4">
      <AllTimePopularSection />
      <div className="min-w-0 w-full">
        <LatestUpdatesSection />
        <PopularSection />
      </div>
      <WeeklyPopularSection />
    </div>
  )
}
