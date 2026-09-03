import type { StoryStatus, StoryType } from './story.model'

export type WriterContentTab = 'novel' | 'cartoon'

export interface GetMyContentsInput {
  tab: WriterContentTab
  page: number
  limit: number
}

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
    published_at: Date | null
  } | null
  created_at: Date
  updated_at: Date
}

export interface WriterContentCount {
  total: string
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

export interface MyContentsResult {
  contents: WriterContent[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface CreateWriterContentInput {
  type: StoryType
  title: string
  slug: string
  synopsis?: string
  status: StoryStatus
  age_rating?: string
  primary_genre_id: string
  secondary_genre_id?: string
  cover?: File
}

export interface UpdateWriterContentInput extends CreateWriterContentInput {
  remove_cover?: 'true'
}

export interface CreatedStory {
  id: string
  type: StoryType
  slug: string
  cover_url: string | null
}
