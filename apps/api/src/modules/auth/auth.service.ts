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

const REFRESH_SESSION_TTL_DAYS = 7

function hashTokenId(tokenId: string): string {
  return new Bun.CryptoHasher('sha256').update(tokenId).digest('hex')
}

export async function findActiveUserById(id: string): Promise<AuthenticatedUser | null> {
  const [user] = await db<AuthenticatedUser[]>`
    SELECT
      id,
      email,
      username,
      display_name,
      avatar_url,
      role,
      status
    FROM users
    WHERE id = ${id}
      AND status = 'active'
      AND deleted_at IS NULL
    LIMIT 1
  `

  return user ?? null
}

export async function createAuthSession(userId: string, tokenId: string): Promise<string> {
  const sessionId = crypto.randomUUID()

  await db`
    INSERT INTO auth_sessions (
      id,
      user_id,
      refresh_token_hash,
      expires_at
    ) VALUES (
      ${sessionId},
      ${userId},
      ${hashTokenId(tokenId)},
      NOW() + (${REFRESH_SESSION_TTL_DAYS} * INTERVAL '1 day')
    )
  `

  return sessionId
}

export async function rotateAuthSession(
  sessionId: string,
  userId: string,
  currentTokenId: string,
  nextTokenId: string,
): Promise<boolean> {
  const sessions = await db<{ id: string }[]>`
    UPDATE auth_sessions
    SET
      refresh_token_hash = ${hashTokenId(nextTokenId)},
      expires_at = NOW() + (${REFRESH_SESSION_TTL_DAYS} * INTERVAL '1 day'),
      updated_at = NOW()
    WHERE id = ${sessionId}
      AND user_id = ${userId}
      AND refresh_token_hash = ${hashTokenId(currentTokenId)}
      AND revoked_at IS NULL
      AND expires_at > NOW()
    RETURNING id
  `

  return sessions.length === 1
}

export async function revokeAuthSession(sessionId: string, userId: string): Promise<void> {
  await db`
    UPDATE auth_sessions
    SET revoked_at = COALESCE(revoked_at, NOW()), updated_at = NOW()
    WHERE id = ${sessionId}
      AND user_id = ${userId}
  `
}

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
