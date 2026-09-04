import type { StoryStatus, StoryType } from '@/constants/story.constant'

interface ContentGenre {
  id: string
  name: string
  slug: string
}

export interface PublicContent {
  id: string
  title: string
  slug: string
  synopsis: string | null
  cover_url: string | null
  cover_blur_data_url: string | null
  type: StoryType
  status: StoryStatus
  age_rating: number | null
  total_views: string
  published_at: string | null
  updated_at: string
  chapter_count: string
  latest_chapter: {
    id: string
    chapter_number: string
    title: string
    published_at: string
  } | null
  author: {
    id: string
    username: string
    display_name: string
  }
  primary_genre: ContentGenre
  secondary_genre: ContentGenre | null
}

export interface PublicContentResponse {
  story: PublicContent
}

export interface PublicChapter {
  id: string
  chapter_number: string
  title: string
  is_free: boolean
  price: string
  published_at: string
}

export interface PublicChaptersResponse {
  chapters: PublicChapter[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
}

export interface PublicContentSitemapResponse {
  contents: Array<{
    slug: string
    cover_url: string | null
    updated_at: string
  }>
}
