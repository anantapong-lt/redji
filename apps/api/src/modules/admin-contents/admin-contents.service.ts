import { db } from '../../db'
import { MODERATION_STATUS, type ModerationStatus, type StoryType } from '../../models/story.model'

type AdminContentTypeFilter = StoryType | 'all'
type AdminContentStatusFilter = ModerationStatus | 'all'

export interface AdminContent {
  id: string
  title: string
  slug: string
  type: StoryType
  status: ModerationStatus
  cover_url: string | null
  total_views: string
  chapter_count: string
  sales_total: string
  author: { username: string; display_name: string }
  primary_genre: { id: string; name: string }
  secondary_genre: { id: string; name: string } | null
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
}

export async function findAdminContents(
  page: number,
  limit: number,
  search: string,
  type: AdminContentTypeFilter,
  status: AdminContentStatusFilter,
  genreId: string | null,
) {
  const offset = (page - 1) * limit
  const [contents, [count]] = await Promise.all([
    db<AdminContent[]>`
      SELECT
        stories.id, stories.title, stories.slug, stories.type, stories.moderation_status AS status, stories.deleted_at,
        stories.cover_url, stories.total_views::TEXT,
        (SELECT COUNT(*)::TEXT FROM chapters WHERE chapters.story_id = stories.id) AS chapter_count,
        (
          SELECT ROUND(COALESCE(SUM(chapter_purchases.price), 0), 2)::TEXT
          FROM chapter_purchases
          INNER JOIN chapters ON chapters.id = chapter_purchases.chapter_id
          WHERE chapters.story_id = stories.id
        ) AS sales_total,
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
        AND (${type}::TEXT = 'all' OR stories.type::TEXT = ${type}::TEXT)
        AND (${status}::TEXT = 'all' OR stories.moderation_status::TEXT = ${status}::TEXT)
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
        AND (${type}::TEXT = 'all' OR stories.type::TEXT = ${type}::TEXT)
        AND (${status}::TEXT = 'all' OR stories.moderation_status::TEXT = ${status}::TEXT)
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

export async function updateAdminContentStatus(contentId: string, status: ModerationStatus): Promise<boolean> {
  return db.begin(async (transaction) => {
    const [content] = await transaction<Array<{ id: string }>>`
      UPDATE stories
      SET moderation_status = ${status}::moderation_status, updated_at = NOW()
      WHERE id = ${contentId}
      RETURNING id
    `
    if (!content) return false

    return true
  })
}

export function softDeleteAdminContent(contentId: string, _reason: string): Promise<boolean> {
  return updateAdminContentStatus(contentId, MODERATION_STATUS.HIDDEN)
}

export async function restoreAdminContentVisibility(contentId: string): Promise<boolean> {
  return updateAdminContentStatus(contentId, MODERATION_STATUS.ACTIVE)
}
