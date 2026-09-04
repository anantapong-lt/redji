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
