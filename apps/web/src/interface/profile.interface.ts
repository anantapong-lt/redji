export type ProfileSocialKey = 'facebook' | 'instagram' | 'x' | 'tiktok' | 'youtube' | 'website'

export interface ProfileSocialLinks {
  facebook?: string
  instagram?: string
  x?: string
  tiktok?: string
  youtube?: string
  website?: string
}

export interface ProfileStory {
  id: string
  title: string
  slug: string
  cover_url: string | null
  cover_blur_data_url: string | null
  type: 'novel' | 'manga'
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled'
  rating_average: string
  chapter_count: string
  latest_chapter: { chapter_number: string } | null
}

export interface UserProfile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  profile_cover_url: string | null
  role: 'user' | 'writer' | 'super_admin'
  bio: string | null
  social_links: ProfileSocialLinks
  created_at: string
  story_counts: { novel: number; manga: number }
  stories: ProfileStory[]
  pagination: { page: number; limit: number; has_next_page: boolean }
}

export interface RandomWriterProfile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  story_count: string
}
