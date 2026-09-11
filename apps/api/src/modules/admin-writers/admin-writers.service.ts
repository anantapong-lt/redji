import { db } from '../../db'
import { USER_ROLE, type UserStatus } from '../../models/user.model'

export interface AdminWriter {
  id: string
  display_name: string
  username: string
  email: string
  phone_number: string | null
  avatar_url: string | null
  status: UserStatus
  balance: string
  created_at: Date
  last_login_at: Date | null
  content_count: string
  chapter_count: string
  total_views: string
  sales_count: string
  sales_total: string
}

export async function countAdminWriters(search: string, status: UserStatus | null) {
  const [row] = await db<{ total: string }[]>`
    SELECT COUNT(*)::TEXT AS total
    FROM users
    WHERE role = ${USER_ROLE.WRITER}
      AND deleted_at IS NULL
      AND (${status}::TEXT IS NULL OR users.status = ${status})
      AND (
        ${search} = ''
        OR STRPOS(LOWER(email), LOWER(${search})) > 0
        OR STRPOS(LOWER(username), LOWER(${search})) > 0
        OR STRPOS(LOWER(display_name), LOWER(${search})) > 0
      )
  `
  return Number(row?.total ?? 0)
}

export function findAdminWriters(page: number, limit: number, search: string, status: UserStatus | null) {
  return db<AdminWriter[]>`
    SELECT
      users.id, users.display_name, users.username, users.email, users.phone_number, users.avatar_url,
      users.status, users.balance::TEXT, users.created_at, users.last_login_at,
      (
        SELECT COUNT(*)::TEXT
        FROM stories
        WHERE stories.creator_user_id = users.id AND stories.deleted_at IS NULL
      ) AS content_count,
      (
        SELECT COUNT(*)::TEXT
        FROM chapters
        INNER JOIN stories ON stories.id = chapters.story_id
        WHERE stories.creator_user_id = users.id AND stories.deleted_at IS NULL
      ) AS chapter_count,
      (
        SELECT COALESCE(SUM(stories.total_views), 0)::TEXT
        FROM stories
        WHERE stories.creator_user_id = users.id AND stories.deleted_at IS NULL
      ) AS total_views,
      (
        SELECT COUNT(*)::TEXT
        FROM chapter_purchases
        WHERE chapter_purchases.writer_user_id = users.id
      ) AS sales_count,
      (
        SELECT ROUND(COALESCE(SUM(chapter_purchases.price), 0), 2)::NUMERIC(12, 2)::TEXT
        FROM chapter_purchases
        WHERE chapter_purchases.writer_user_id = users.id
      ) AS sales_total
    FROM users
    WHERE users.role = ${USER_ROLE.WRITER}
      AND users.deleted_at IS NULL
      AND (${status}::TEXT IS NULL OR users.status = ${status})
      AND (
        ${search} = ''
        OR STRPOS(LOWER(users.email), LOWER(${search})) > 0
        OR STRPOS(LOWER(users.username), LOWER(${search})) > 0
        OR STRPOS(LOWER(users.display_name), LOWER(${search})) > 0
      )
    ORDER BY users.created_at DESC, users.id DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `
}

export async function updateAdminWriterStatus(id: string, status: UserStatus): Promise<{ id: string; status: UserStatus } | null> {
  const [writer] = await db<Array<{ id: string; status: UserStatus }>>`
    UPDATE users
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${id}
      AND role = ${USER_ROLE.WRITER}
      AND deleted_at IS NULL
    RETURNING id, status
  `
  return writer ?? null
}
