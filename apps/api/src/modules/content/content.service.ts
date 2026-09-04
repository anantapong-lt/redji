import { db } from '../../db'
import type { StoryStatus, StoryType } from '../../models/story.model'

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
  primary_genre: {
    id: string
    name: string
    slug: string
  }
  secondary_genre: {
    id: string
    name: string
    slug: string
  } | null
}

export async function findPublicContentBySlug(
  slug: string,
): Promise<PublicContent | undefined> {
  const [story] = await db<PublicContent[]>`
    SELECT
      stories.id,
      stories.title,
      stories.slug,
      stories.synopsis,
      stories.cover_url,
      stories.cover_blur_data_url,
      stories.type,
      stories.status,
      stories.age_rating,
      stories.total_views::TEXT,
      json_build_object(
        'id', users.id,
        'username', users.username,
        'display_name', users.display_name
      ) AS author,
      json_build_object(
        'id', primary_genre.id,
        'name', primary_genre.name,
        'slug', primary_genre.slug
      ) AS primary_genre,
      CASE
        WHEN secondary_genre.id IS NULL THEN NULL
        ELSE json_build_object(
          'id', secondary_genre.id,
          'name', secondary_genre.name,
          'slug', secondary_genre.slug
        )
      END AS secondary_genre
    FROM stories
    INNER JOIN users ON users.id = stories.creator_user_id
    INNER JOIN genres AS primary_genre ON primary_genre.id = stories.primary_genre_id
    LEFT JOIN genres AS secondary_genre ON secondary_genre.id = stories.secondary_genre_id
    WHERE LOWER(stories.slug) = LOWER(${slug})
      AND stories.status IN ('ongoing', 'completed')
      AND stories.deleted_at IS NULL
      AND users.status = 'active'
      AND users.deleted_at IS NULL
    LIMIT 1
  `

  return story
}
