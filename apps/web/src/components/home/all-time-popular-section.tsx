import { PopularRankingSection } from '@/components/home/popular-ranking-section'

export function AllTimePopularSection() {
  return (
    <PopularRankingSection
      section="all-time"
      headingId="all-time-popular-heading"
      heading="ยอดนิยมตลอดกาล"
      description="เรื่องที่มียอดอ่านสะสมสูงสุด"
    />
  )
}
