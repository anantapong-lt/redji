export interface WriterStats {
  story_count: string
  chapter_count: string
  total_views: string
  favorite_count: string
  free_chapter_count: string
}

export type WriterDashboardPeriod = 'today' | 'this-week' | 'this-month'

export interface WriterDashboardData {
  stats: WriterStats
  period: WriterDashboardPeriod
  activity: {
    bucket: string
    gross_sales: string
    view_count: string
  }[]
  top_stories: {
    sales: { id: string; title: string; value: string }[]
    views: { id: string; title: string; value: string }[]
  }
}
