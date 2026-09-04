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
  favorite_count: string
  is_favorited: boolean
  rating_average: string
  rating_count: string
  user_rating: number | null
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
  chapters: PublicChaptersResponse
}

export interface PublicContentFavoriteResponse {
  is_favorited: boolean
  favorite_count: number
}

export interface PublicContentRatingResponse {
  user_rating: number
  rating_average: number
  rating_count: number
}

export type PublicChapterSort = 'latest' | 'oldest' | 'chapter_asc' | 'chapter_desc'

export interface PublicChapter {
  id: string
  chapter_number: string
  title: string
  is_free: boolean
  price: string
  published_at: string
  is_purchased: boolean
  is_owner: boolean
  can_read: boolean
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
