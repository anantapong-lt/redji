import { db } from '../../db'
import { USER_ROLE, type UserStatus } from '../../models/user.model'

interface AdminAccountRow {
  id: string
  email: string
  username: string
  display_name: string
  status: UserStatus
  email_verified_at: Date | null
  last_login_at: Date | null
  created_at: Date
}

export async function countAdminAccounts(search: string): Promise<number> {
  const [row] = await db<{ total: string }[]>`
    SELECT COUNT(*)::TEXT AS total
    FROM users
    WHERE deleted_at IS NULL
      AND role = ${USER_ROLE.SUPER_ADMIN}
      AND (
        ${search} = ''
        OR STRPOS(LOWER(email), LOWER(${search})) > 0
        OR STRPOS(LOWER(username), LOWER(${search})) > 0
        OR STRPOS(LOWER(display_name), LOWER(${search})) > 0
      )
  `
  return Number(row?.total ?? 0)
}

export function findAdminAccounts(page: number, limit: number, search: string) {
  return db<AdminAccountRow[]>`
    SELECT id, email, username, display_name, status, email_verified_at, last_login_at, created_at
    FROM users
    WHERE deleted_at IS NULL
      AND role = ${USER_ROLE.SUPER_ADMIN}
      AND (
        ${search} = ''
        OR STRPOS(LOWER(email), LOWER(${search})) > 0
        OR STRPOS(LOWER(username), LOWER(${search})) > 0
        OR STRPOS(LOWER(display_name), LOWER(${search})) > 0
      )
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `
}

export async function insertAdminAccount(input: {
  displayName: string
  username: string
  email: string
  passwordHash: string
}) {
  return db.begin(async (transaction) => {
    const [account] = await transaction<AdminAccountRow[]>`
      INSERT INTO users (email, username, display_name, role, status, email_verified_at)
      VALUES (
        ${input.email},
        ${input.username},
        ${input.displayName},
        ${USER_ROLE.SUPER_ADMIN},
        'active',
        NOW()
      )
      RETURNING id, email, username, display_name, status, email_verified_at, last_login_at, created_at
    `

    if (!account) throw new Error('Unable to create admin account')

    await transaction`
      INSERT INTO user_password_credentials (user_id, password_hash)
      VALUES (${account.id}, ${input.passwordHash})
    `

    return account
  })
}

export async function updateAdminAccountStatus(id: string, status: UserStatus): Promise<{ id: string; status: UserStatus } | null> {
  const [account] = await db<Array<{ id: string; status: UserStatus }>>`
    UPDATE users
    SET status = ${status},
        updated_at = NOW()
    WHERE id = ${id}
      AND role = ${USER_ROLE.SUPER_ADMIN}
      AND deleted_at IS NULL
    RETURNING id, status
  `
  return account ?? null
}
