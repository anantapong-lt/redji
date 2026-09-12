import { db } from '../../db'
import type { StoryStatus, StoryType } from '../../models/story.model'

type AdminContentTypeFilter = StoryType | 'all'
type AdminContentStatusFilter = StoryStatus | 'all'
type AdminContentVisibilityFilter = 'visible' | 'hidden' | 'all'

export interface AdminContent {
  id: string
  title: string
  slug: string
  type: StoryType
  status: StoryStatus
  cover_url: string | null
  total_views: string
  chapter_count: string
  author: { username: string; display_name: string }
  primary_genre: { id: string; name: string }
  secondary_genre: { id: string; name: string } | null
  created_at: Date
  updated_at: Date
}

export async function findAdminContents(
  page: number,
  limit: number,
  search: string,
  type: AdminContentTypeFilter,
  status: AdminContentStatusFilter,
  visibility: AdminContentVisibilityFilter,
  genreId: string | null,
) {
  const offset = (page - 1) * limit
  const [contents, [count]] = await Promise.all([
    db<AdminContent[]>`
      SELECT
        stories.id, stories.title, stories.slug, stories.type, stories.status, stories.deleted_at,
        stories.cover_url, stories.total_views::TEXT,
        (SELECT COUNT(*)::TEXT FROM chapters WHERE chapters.story_id = stories.id) AS chapter_count,
        json_build_object('username', users.username, 'display_name', users.display_name) AS author,
        json_build_object('id', primary_genre.id, 'name', primary_genre.name) AS primary_genre,
        CASE WHEN secondary_genre.id IS NULL THEN NULL
          ELSE json_build_object('id', secondary_genre.id, 'name', secondary_genre.name)
        END AS secondary_genre,
        stories.created_at, stories.updated_at
      FROM stories
      INNER JOIN users ON users.id = stories.creator_user_id
      INNER JOIN genres AS primary_genre ON primary_genre.id = stories.primary_genre_id
      LEFT JOIN genres AS secondary_genre ON secondary_genre.id = stories.secondary_genre_id
      WHERE users.deleted_at IS NULL
        AND (
          ${visibility} = 'all'
          OR (${visibility} = 'visible' AND stories.deleted_at IS NULL)
          OR (${visibility} = 'hidden' AND stories.deleted_at IS NOT NULL)
        )
        AND (${type}::TEXT = 'all' OR stories.type::TEXT = ${type}::TEXT)
        AND (${status}::TEXT = 'all' OR stories.status::TEXT = ${status}::TEXT)
        AND (${genreId}::UUID IS NULL OR stories.primary_genre_id = ${genreId} OR stories.secondary_genre_id = ${genreId})
        AND (
          ${search} = ''
          OR STRPOS(LOWER(stories.title), LOWER(${search})) > 0
          OR STRPOS(LOWER(stories.slug), LOWER(${search})) > 0
          OR STRPOS(LOWER(users.username), LOWER(${search})) > 0
          OR STRPOS(LOWER(users.display_name), LOWER(${search})) > 0
        )
      ORDER BY stories.updated_at DESC, stories.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    db<{ total: string }[]>`
      SELECT COUNT(*)::TEXT AS total
      FROM stories
      INNER JOIN users ON users.id = stories.creator_user_id
      WHERE users.deleted_at IS NULL
        AND (
          ${visibility} = 'all'
          OR (${visibility} = 'visible' AND stories.deleted_at IS NULL)
          OR (${visibility} = 'hidden' AND stories.deleted_at IS NOT NULL)
        )
        AND (${type}::TEXT = 'all' OR stories.type::TEXT = ${type}::TEXT)
        AND (${status}::TEXT = 'all' OR stories.status::TEXT = ${status}::TEXT)
        AND (${genreId}::UUID IS NULL OR stories.primary_genre_id = ${genreId} OR stories.secondary_genre_id = ${genreId})
        AND (
          ${search} = ''
          OR STRPOS(LOWER(stories.title), LOWER(${search})) > 0
          OR STRPOS(LOWER(stories.slug), LOWER(${search})) > 0
          OR STRPOS(LOWER(users.username), LOWER(${search})) > 0
          OR STRPOS(LOWER(users.display_name), LOWER(${search})) > 0
        )
    `,
  ])
  const total = Number(count?.total ?? 0)
  return { contents, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }
}

export async function softDeleteAdminContent(contentId: string): Promise<boolean> {
  const [content] = await db<{ id: string }[]>`
    UPDATE stories
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = ${contentId}
      AND deleted_at IS NULL
    RETURNING id
  `
  return Boolean(content)
}

export async function restoreAdminContentVisibility(contentId: string): Promise<boolean> {
  const [content] = await db<{ id: string }[]>`
    UPDATE stories
    SET deleted_at = NULL, updated_at = NOW()
    WHERE id = ${contentId}
      AND deleted_at IS NOT NULL
    RETURNING id
  `
  return Boolean(content)
}
