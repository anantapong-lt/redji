import { db } from '../../db'
import type { StoryType } from '../../models/story.model'
import type { LandingSection } from './landing.schema'

interface LandingStory {
  id: string
  title: string
  slug: string
  cover_url: string | null
  cover_blur_data_url: string | null
  type: StoryType
  total_views: string
  ranking_views: string
  rating_average: string
  rating_count: string
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
        stories.cover_blur_data_url,
        stories.type,
        stories.total_views::TEXT,
        CASE
          WHEN ${section} = 'weekly'
            THEN COALESCE(weekly_stats.weekly_views, 0)::TEXT
          ELSE stories.total_views::TEXT
        END AS ranking_views,
        COALESCE(rating_stats.rating_average, '0.0') AS rating_average,
        COALESCE(rating_stats.rating_count, '0') AS rating_count,
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
        ORDER BY chapters.chapter_number DESC, chapters.id DESC
        LIMIT 1
      ) AS latest_chapter ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          ROUND(AVG(story_ratings.rating)::NUMERIC, 1)::TEXT AS rating_average,
          COUNT(*)::TEXT AS rating_count
        FROM story_ratings
        WHERE story_ratings.story_id = stories.id
      ) AS rating_stats ON TRUE
      LEFT JOIN (
        SELECT story_id, SUM(view_count)::BIGINT AS weekly_views
        FROM story_daily_views
        WHERE view_date >= (
          (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::DATE - 6
        )
        GROUP BY story_id
      ) AS weekly_stats ON weekly_stats.story_id = stories.id
      WHERE stories.status IN ('ongoing', 'completed')
        AND stories.deleted_at IS NULL
        AND users.status = 'active'
        AND users.deleted_at IS NULL
        AND (
          ${section} <> 'weekly'
          OR COALESCE(weekly_stats.weekly_views, 0) > 0
        )
      ORDER BY
        CASE WHEN ${section} = 'latest' THEN latest_chapter.published_at END DESC,
        CASE WHEN ${section} = 'weekly' THEN COALESCE(weekly_stats.weekly_views, 0) END DESC,
        CASE WHEN ${section} IN ('popular', 'all-time') THEN stories.total_views END DESC,
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
        AND (
          ${section} <> 'weekly'
          OR EXISTS (
            SELECT 1
            FROM story_daily_views
            WHERE story_daily_views.story_id = stories.id
              AND story_daily_views.view_date >= (
                (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::DATE - 6
              )
              AND story_daily_views.view_count > 0
          )
        )
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
