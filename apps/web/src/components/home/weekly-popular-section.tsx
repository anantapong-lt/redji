import { PopularRankingSection } from '@/components/home/popular-ranking-section'

export function WeeklyPopularSection() {
  return (
    <PopularRankingSection
      section="weekly"
      headingId="weekly-popular-heading"
      heading="ยอดนิยมประจำสัปดาห์"
      description="เรื่องที่ได้รับความนิยมในช่วง 7 วันที่ผ่านมา"
    />
  )
}
