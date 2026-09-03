import type { StoryStatus, StoryType } from '@/constants/story.constant'

export type WriterContentTab = 'novel' | 'cartoon'

export interface WriterContent {
  id: string
  title: string
  slug: string
  cover_url: string | null
  type: StoryType
  status: StoryStatus
  total_views: string
  chapter_count: string
  sales_count: string
  latest_chapter: {
    chapter_number: string
    title: string
    status: string
    published_at: string | null
  } | null
  created_at: string
  updated_at: string
}

export interface WriterContentsResponse {
  contents: WriterContent[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface WriterContentDetail {
  id: string
  title: string
  slug: string
  synopsis: string | null
  cover_url: string | null
  type: StoryType
  status: StoryStatus
  age_rating: number | null
  primary_genre_id: string
  secondary_genre_id: string | null
}
