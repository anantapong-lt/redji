import { db } from '../../db'
import type { UserStatus } from '../../models/user.model'

interface AdminUserRow {
  id: string
  email: string
  username: string
  display_name: string
  balance: string
  role: string
  status: UserStatus
  email_verified_at: Date | null
  last_login_at: Date | null
  created_at: Date
}

export async function countAdminUsers(search: string, status: UserStatus | null): Promise<number> {
  const [row] = await db<{ total: string }[]>`
    SELECT COUNT(*)::TEXT AS total
    FROM users
    WHERE deleted_at IS NULL
      AND (${status}::TEXT IS NULL OR users.status = ${status})
      AND (
        ${search} = ''
        OR STRPOS(LOWER(users.email), LOWER(${search})) > 0
        OR STRPOS(LOWER(users.username), LOWER(${search})) > 0
        OR STRPOS(LOWER(users.display_name), LOWER(${search})) > 0
      )
  `
  return Number(row?.total ?? 0)
}

export function findAdminUsers(page: number, limit: number, search: string, status: UserStatus | null) {
  return db<AdminUserRow[]>`
    SELECT id, email, username, display_name, balance::TEXT, role, status,
      email_verified_at, last_login_at, created_at
    FROM users
    WHERE deleted_at IS NULL
      AND (${status}::TEXT IS NULL OR users.status = ${status})
      AND (
        ${search} = ''
        OR STRPOS(LOWER(users.email), LOWER(${search})) > 0
        OR STRPOS(LOWER(users.username), LOWER(${search})) > 0
        OR STRPOS(LOWER(users.display_name), LOWER(${search})) > 0
      )
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `
}
