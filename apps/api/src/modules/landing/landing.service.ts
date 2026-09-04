import { db } from '../../db'
import type { StoryType } from '../../models/story.model'
import type { LandingSection } from './landing.schema'

interface LandingStory {
  id: string
  title: string
  slug: string
  cover_url: string | null
  type: StoryType
  total_views: string
  author: {
    id: string
    username: string
    display_name: string
  }
  latest_chapter: {
    id: string
    chapter_number: string
    title: string
    published_at: Date
  }
}

interface LandingStoryCount {
  total: string
}

export interface LandingResult {
  section: LandingSection
  stories: LandingStory[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
}

export async function getLandingStories(
  section: LandingSection,
  page: number,
  limit: number,
): Promise<LandingResult> {
  const offset = (page - 1) * limit
  const [stories, [count]] = await Promise.all([
    db<LandingStory[]>`
      SELECT
        stories.id,
        stories.title,
        stories.slug,
        stories.cover_url,
        stories.type,
        stories.total_views::TEXT,
        json_build_object(
          'id', users.id,
          'username', users.username,
          'display_name', users.display_name
        ) AS author,
        json_build_object(
          'id', latest_chapter.id,
          'chapter_number', latest_chapter.chapter_number::TEXT,
          'title', latest_chapter.title,
          'published_at', latest_chapter.published_at
        ) AS latest_chapter
      FROM stories
      INNER JOIN users ON users.id = stories.creator_user_id
      INNER JOIN LATERAL (
        SELECT chapters.id, chapters.chapter_number, chapters.title,
          chapters.published_at
        FROM chapters
        WHERE chapters.story_id = stories.id
          AND chapters.status = 'published'
          AND chapters.published_at <= NOW()
        ORDER BY chapters.published_at DESC, chapters.id DESC
        LIMIT 1
      ) AS latest_chapter ON TRUE
      WHERE stories.status IN ('ongoing', 'completed')
        AND stories.deleted_at IS NULL
        AND users.status = 'active'
        AND users.deleted_at IS NULL
      ORDER BY
        CASE WHEN ${section} = 'latest' THEN latest_chapter.published_at END DESC,
        CASE WHEN ${section} = 'popular' THEN stories.total_views END DESC,
        stories.id DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `,
    db<LandingStoryCount[]>`
      SELECT COUNT(*)::TEXT AS total
      FROM stories
      INNER JOIN users ON users.id = stories.creator_user_id
      WHERE stories.status IN ('ongoing', 'completed')
        AND stories.deleted_at IS NULL
        AND users.status = 'active'
        AND users.deleted_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM chapters
          WHERE chapters.story_id = stories.id
            AND chapters.status = 'published'
            AND chapters.published_at <= NOW()
        )
    `,
  ])

  const total = Number(count.total)
  const totalPages = Math.ceil(total / limit)

  return {
    section,
    stories,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
  }
}
