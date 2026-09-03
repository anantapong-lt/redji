import { db } from '../../db'
import type { UserModel } from '../../models/user.model'

interface UserWithPassword extends UserModel {
  password_hash: string
}

export type AuthenticatedUser = Pick<
  UserModel,
  'id' | 'email' | 'username' | 'display_name' | 'avatar_url' | 'role' | 'status'
>

export type AuthenticationResult =
  | { status: 'authenticated'; user: AuthenticatedUser }
  | { status: 'invalid_credentials' }
  | { status: 'inactive' }

export async function authenticateWithPassword(
  email: string,
  password: string,
): Promise<AuthenticationResult> {
  const [user] = await db<UserWithPassword[]>`
    SELECT
      u.*,
      credentials.password_hash
    FROM users AS u
    INNER JOIN user_password_credentials AS credentials
      ON credentials.user_id = u.id
    WHERE LOWER(u.email) = LOWER(${email.trim()})
      AND u.deleted_at IS NULL
    LIMIT 1
  `

  if (!user || !(await Bun.password.verify(password, user.password_hash))) {
    return { status: 'invalid_credentials' }
  }

  if (user.status !== 'active') return { status: 'inactive' }


  await db`
    UPDATE users
    SET last_login_at = NOW(), updated_at = NOW()
    WHERE id = ${user.id}
  `

  return {
    status: 'authenticated',
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      role: user.role,
      status: user.status,
    },
  }
}
