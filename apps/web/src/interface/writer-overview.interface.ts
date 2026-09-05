export type OverviewPeriod = 'today' | 'this-week' | 'this-month'

export interface WriterOverview {
  summary: {
    title: string
    total_views: string
    chapter_count: string
    sales_count: string
    published: string
    draft: string
    scheduled: string
    hidden: string
  }
  period: OverviewPeriod
  purchases: {
    bucket: string
    purchase_count: string
    gross_sales: string
  }[]
}
