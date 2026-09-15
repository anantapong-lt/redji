import { db } from '../../db'
import { env } from '../../config/env'
import type { UserModel } from '../../models/user.model'

interface UserWithPassword extends UserModel {
  password_hash: string
}

export type AuthenticatedUser = Pick<
  UserModel,
  'id' | 'email' | 'username' | 'display_name' | 'avatar_url' | 'balance' | 'role' | 'status'
>

export type AuthenticationResult =
  | { status: 'authenticated'; user: AuthenticatedUser }
  | { status: 'invalid_credentials' }
  | { status: 'inactive' }
  | { status: 'unverified' }

export type GoogleProfile = {
  id: string
  email: string
  name: string
  picture?: string
}

type RegistrationErrorStatus = 400 | 409 | 410

export class RegistrationError extends Error {
  constructor(
    message: string,
    readonly statusCode: RegistrationErrorStatus,
    readonly field?: 'email' | 'username',
  ) {
    super(message)
    this.name = 'RegistrationError'
  }
}

const REFRESH_SESSION_TTL_DAYS = 7

function hashTokenId(tokenId: string): string {
  return new Bun.CryptoHasher('sha256').update(tokenId).digest('hex')
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && error.code === '23505',
  )
}

function createVerificationToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function createEmailRegistration(
  email: string,
  username: string,
  password: string,
): Promise<{ email: string; verificationToken: string }> {
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedUsername = username.trim()

  if (normalizedUsername.length < 3 || normalizedUsername.length > 30) {
    throw new RegistrationError('ชื่อผู้ใช้งานต้องมี 3 ถึง 30 ตัวอักษร', 400, 'username')
  }

  const verificationToken = createVerificationToken()
  const passwordHash = await Bun.password.hash(password)

  try {
    await db.begin(async (transaction) => {
      const [existingUser] = await transaction<{ email_exists: boolean; username_exists: boolean }[]>`
        SELECT
          EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER(${normalizedEmail})) AS email_exists,
          EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER(${normalizedUsername})) AS username_exists
      `

      if (existingUser?.email_exists) {
        throw new RegistrationError('อีเมลนี้ถูกใช้งานแล้ว', 409, 'email')
      }
      if (existingUser?.username_exists) {
        throw new RegistrationError('ชื่อผู้ใช้งานนี้ถูกใช้งานแล้ว', 409, 'username')
      }

      await transaction`
        DELETE FROM email_registration_requests
        WHERE expires_at <= NOW()
      `

      await transaction`
        INSERT INTO email_registration_requests (
          email,
          username,
          display_name,
          password_hash,
          verification_token_hash,
          expires_at
        ) VALUES (
          ${normalizedEmail},
          ${normalizedUsername},
          ${normalizedUsername},
          ${passwordHash},
          ${hashTokenId(verificationToken)},
          NOW() + (${env.EMAIL_VERIFICATION_TTL_HOURS} * INTERVAL '1 hour')
        )
        ON CONFLICT (LOWER(email)) DO UPDATE SET
          username = EXCLUDED.username,
          display_name = EXCLUDED.display_name,
          password_hash = EXCLUDED.password_hash,
          verification_token_hash = EXCLUDED.verification_token_hash,
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW()
      `
    })
  } catch (error) {
    if (error instanceof RegistrationError) throw error
    if (isUniqueViolation(error)) {
      throw new RegistrationError('ชื่อผู้ใช้งานนี้กำลังรอการยืนยันจากอีเมลอื่น', 409, 'username')
    }
    throw error
  }

  return { email: normalizedEmail, verificationToken }
}

export async function verifyEmailRegistration(token: string): Promise<void> {
  const tokenHash = hashTokenId(token)

  try {
    await db.begin(async (transaction) => {
      const [registration] = await transaction<{
        id: string
        email: string
        username: string
        display_name: string
        password_hash: string
        expires_at: Date
      }[]>`
        SELECT id, email, username, display_name, password_hash, expires_at
        FROM email_registration_requests
        WHERE verification_token_hash = ${tokenHash}
        LIMIT 1
        FOR UPDATE
      `

      if (!registration) {
        throw new RegistrationError('ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือถูกใช้งานแล้ว', 410)
      }
      if (new Date(registration.expires_at).getTime() <= Date.now()) {
        await transaction`
          DELETE FROM email_registration_requests WHERE id = ${registration.id}
        `
        throw new RegistrationError('ลิงก์ยืนยันอีเมลหมดอายุแล้ว กรุณาสมัครใหม่อีกครั้ง', 410)
      }

      const [user] = await transaction<{ id: string }[]>`
        INSERT INTO users (email, username, display_name, email_verified_at)
        VALUES (
          ${registration.email},
          ${registration.username},
          ${registration.display_name},
          NOW()
        )
        RETURNING id
      `
      if (!user) throw new Error('Unable to create verified user')

      await transaction`
        INSERT INTO user_password_credentials (user_id, password_hash)
        VALUES (${user.id}, ${registration.password_hash})
      `
      await transaction`
        DELETE FROM email_registration_requests WHERE id = ${registration.id}
      `
    })
  } catch (error) {
    if (error instanceof RegistrationError) throw error
    if (isUniqueViolation(error)) {
      throw new RegistrationError('อีเมลหรือชื่อผู้ใช้งานนี้ถูกใช้งานแล้ว', 409)
    }
    throw error
  }
}

export async function findActiveUserById(id: string): Promise<AuthenticatedUser | null> {
  const [user] = await db<AuthenticatedUser[]>`
    SELECT
      id,
      email,
      username,
      display_name,
      avatar_url,
      balance,
      role,
      status
    FROM users
    WHERE id = ${id}
      AND status = 'active'
      AND email_verified_at IS NOT NULL
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

export async function validateAuthSession(
  sessionId: string,
  userId: string,
  tokenId: string,
): Promise<boolean> {
  const sessions = await db<{ id: string }[]>`
    SELECT id
    FROM auth_sessions
    WHERE id = ${sessionId}
      AND user_id = ${userId}
      AND refresh_token_hash = ${hashTokenId(tokenId)}
      AND revoked_at IS NULL
      AND expires_at > NOW()
    LIMIT 1
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
  if (!user.email_verified_at) return { status: 'unverified' }


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
      balance: user.balance,
      role: user.role,
      status: user.status,
    },
  }
}

function usernameBase(email: string): string {
  const localPart = email.split('@')[0] ?? 'reader'
  const normalized = localPart.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '')
  return (normalized || 'reader').slice(0, 23)
}

function generatedUsername(email: string, attempt: number): string {
  const suffix = `${Math.floor(Math.random() * 900000 + 100000)}${attempt || ''}`
  return `${usernameBase(email).slice(0, 30 - suffix.length)}${suffix}`
}

/** Finds a Google account or creates it as an already verified account. */
export async function authenticateWithGoogle(
  profile: GoogleProfile,
  allowRegistration: boolean,
): Promise<{ user: AuthenticatedUser; created: boolean } | { status: 'inactive' | 'not_registered' | 'email_exists' }> {
  const email = profile.email.trim().toLowerCase()

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await db.begin(async (transaction) => {
        const [linkedUser] = await transaction<AuthenticatedUser[]>`
          SELECT u.id, u.email, u.username, u.display_name, u.avatar_url, u.balance, u.role, u.status
          FROM user_oauth_accounts AS oauth
          INNER JOIN users AS u ON u.id = oauth.user_id
          WHERE oauth.provider = 'google'
            AND oauth.provider_account_id = ${profile.id}
            AND u.deleted_at IS NULL
          LIMIT 1
          FOR UPDATE
        `

        if (linkedUser) {
          if (linkedUser.status !== 'active') return { status: 'inactive' as const }
          await transaction`UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ${linkedUser.id}`
          return { user: linkedUser, created: false }
        }

        const [emailUser] = await transaction<AuthenticatedUser[]>`
          SELECT id, email, username, display_name, avatar_url, balance, role, status
          FROM users
          WHERE LOWER(email) = ${email} AND deleted_at IS NULL
          LIMIT 1
          FOR UPDATE
        `

        if (emailUser) {
          if (emailUser.status !== 'active') return { status: 'inactive' as const }
          return { status: 'email_exists' as const }
        }

        if (!allowRegistration) return { status: 'not_registered' as const }

        const [newUser] = await transaction<AuthenticatedUser[]>`
          INSERT INTO users (email, username, display_name, avatar_url, email_verified_at, last_login_at)
          VALUES (${email}, ${generatedUsername(email, attempt)}, ${profile.name.slice(0, 100) || email}, ${profile.picture ?? null}, NOW(), NOW())
          RETURNING id, email, username, display_name, avatar_url, balance, role, status
        `
        if (!newUser) throw new Error('Unable to create Google user')
        await transaction`
          INSERT INTO user_oauth_accounts (user_id, provider, provider_account_id, provider_email)
          VALUES (${newUser.id}, 'google', ${profile.id}, ${email})
        `
        return { user: newUser, created: true }
      })
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === 4) throw error
    }
  }

  throw new Error('Unable to create Google user')
}
