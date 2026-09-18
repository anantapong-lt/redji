import { db } from '../../db'
import { env } from '../../config/env'
import type { GoogleProfile } from './auth.service'

const PHONE_OTP_TTL_MINUTES = 10

export class PhoneOtpProviderError extends Error {
  constructor(
    public readonly reason: 'not_configured' | 'unavailable' | 'rejected',
    public readonly providerStatus?: number,
  ) {
    super(reason)
  }
}

function thaiBulkSmsCredentials() {
  if (!env.THAIBULKSMS_OTP_KEY || !env.THAIBULKSMS_OTP_SECRET) {
    throw new PhoneOtpProviderError('not_configured')
  }
  return { key: env.THAIBULKSMS_OTP_KEY, secret: env.THAIBULKSMS_OTP_SECRET }
}

async function thaiBulkSmsOtpRequest(path: '/v2/otp/request' | '/v2/otp/verify', fields: Record<string, string>) {
  const credentials = thaiBulkSmsCredentials()
  const body = new URLSearchParams({ ...credentials, ...fields })

  try {
    const response = await fetch(`https://otp.thaibulksms.com${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    const payload: unknown = await response.json().catch(() => null)
    return { ok: response.ok, status: response.status, payload }
  } catch (error) {
    if (error instanceof PhoneOtpProviderError) throw error
    throw new PhoneOtpProviderError('unavailable')
  }
}

async function requestThaiBulkSmsOtp(phoneNumber: string): Promise<string> {
  const msisdn = phoneNumber.startsWith('+') ? phoneNumber.slice(1) : phoneNumber
  const { ok, status, payload } = await thaiBulkSmsOtpRequest('/v2/otp/request', { msisdn })
  if (!ok) throw new PhoneOtpProviderError(status >= 500 ? 'unavailable' : 'rejected', status)
  if (!payload || typeof payload !== 'object' || !('status' in payload) || payload.status !== 'success' || !('token' in payload) || typeof payload.token !== 'string' || !payload.token) {
    throw new PhoneOtpProviderError('unavailable')
  }
  return payload.token
}

async function verifyThaiBulkSmsOtp(token: string, otp: string): Promise<boolean> {
  const { ok, payload } = await thaiBulkSmsOtpRequest('/v2/otp/verify', { token, pin: otp })
  return Boolean(ok && payload && typeof payload === 'object' && 'status' in payload && payload.status === 'success')
}

export async function getAccountSecurity(userId: string) {
  const [account] = await db<{
    email: string
    email_verified: boolean
    phone_number: string | null
    phone_verified: boolean
    pending_phone_number: string | null
    has_password: boolean
    google_email: string | null
    google_linked_at: Date | null
  }[]>`
    SELECT u.email, u.email_verified_at IS NOT NULL AS email_verified,
      u.phone_number, u.phone_verified_at IS NOT NULL AS phone_verified,
      phone_request.phone_number AS pending_phone_number,
      EXISTS(SELECT 1 FROM user_password_credentials WHERE user_id = u.id) AS has_password,
      oauth.provider_email AS google_email, oauth.created_at AS google_linked_at
    FROM users AS u
    LEFT JOIN user_oauth_accounts AS oauth ON oauth.user_id = u.id AND oauth.provider = 'google'
    LEFT JOIN phone_verification_requests AS phone_request ON phone_request.user_id = u.id AND phone_request.expires_at > NOW()
    WHERE u.id = ${userId} AND u.status = 'active' AND u.deleted_at IS NULL
    LIMIT 1
  `
  return account ?? null
}

export async function requestPhoneVerification(userId: string, phoneNumber: string): Promise<'sent' | 'inactive' | 'phone_in_use'> {
  const [user] = await db<{ id: string }[]>`
    SELECT id FROM users
    WHERE id = ${userId} AND status = 'active'
      AND email_verified_at IS NOT NULL AND deleted_at IS NULL
    LIMIT 1
  `
  if (!user) return 'inactive'

  const [owner] = await db<{ id: string }[]>`
    SELECT id FROM users
    WHERE phone_number = ${phoneNumber} AND id <> ${userId} AND deleted_at IS NULL
    LIMIT 1
  `
  if (owner) return 'phone_in_use'

  const providerToken = await requestThaiBulkSmsOtp(phoneNumber)

  await db`
    INSERT INTO phone_verification_requests (user_id, phone_number, provider_token, expires_at)
    VALUES (${userId}, ${phoneNumber}, ${providerToken}, NOW() + (${PHONE_OTP_TTL_MINUTES} * INTERVAL '1 minute'))
    ON CONFLICT (user_id) DO UPDATE SET
      phone_number = EXCLUDED.phone_number,
      provider_token = EXCLUDED.provider_token,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
  `
  return 'sent'
}

export async function verifyPhoneVerification(
  userId: string,
  phoneNumber: string,
  otp: string,
): Promise<'verified' | 'inactive' | 'invalid_otp' | 'expired' | 'phone_in_use'> {
  try {
    return await db.begin(async (transaction) => {
      const [request] = await transaction<{ provider_token: string; expires_at: Date }[]>`
        SELECT provider_token, expires_at
        FROM phone_verification_requests
        WHERE user_id = ${userId} AND phone_number = ${phoneNumber}
        LIMIT 1
        FOR UPDATE
      `
      if (!request) return 'invalid_otp'
      if (new Date(request.expires_at).getTime() <= Date.now()) {
        await transaction`DELETE FROM phone_verification_requests WHERE user_id = ${userId}`
        return 'expired'
      }

      if (!(await verifyThaiBulkSmsOtp(request.provider_token, otp))) return 'invalid_otp'

      const updated = await transaction<{ id: string }[]>`
        UPDATE users
        SET phone_number = ${phoneNumber}, phone_verified_at = NOW(), updated_at = NOW()
        WHERE id = ${userId} AND status = 'active'
          AND email_verified_at IS NOT NULL AND deleted_at IS NULL
        RETURNING id
      `
      if (!updated.length) return 'inactive'
      await transaction`DELETE FROM phone_verification_requests WHERE user_id = ${userId}`
      return 'verified'
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') return 'phone_in_use'
    throw error
  }
}

export async function changeAccountPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<'changed' | 'no_password' | 'invalid_password' | 'conflict'> {
  const [credentials] = await db<{ password_hash: string }[]>`
    SELECT credentials.password_hash
    FROM user_password_credentials AS credentials
    INNER JOIN users AS u ON u.id = credentials.user_id
    WHERE u.id = ${userId} AND u.status = 'active'
      AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL
    LIMIT 1
  `
  if (!credentials) return 'no_password'
  if (!(await Bun.password.verify(currentPassword, credentials.password_hash))) return 'invalid_password'

  const passwordHash = await Bun.password.hash(newPassword)
  // Compare the old hash as well so simultaneous changes cannot overwrite each other.
  const updated = await db<{ user_id: string }[]>`
    UPDATE user_password_credentials AS credentials
    SET password_hash = ${passwordHash}, password_changed_at = NOW(), updated_at = NOW()
    WHERE credentials.user_id = ${userId}
      AND credentials.password_hash = ${credentials.password_hash}
      AND EXISTS (
        SELECT 1 FROM users WHERE id = ${userId} AND status = 'active'
          AND email_verified_at IS NOT NULL AND deleted_at IS NULL
      )
    RETURNING user_id
  `
  return updated.length === 1 ? 'changed' : 'conflict'
}

export async function unlinkGoogleAccount(
  userId: string,
  currentPassword: string,
): Promise<'unlinked' | 'no_password' | 'invalid_password' | 'not_linked'> {
  return db.begin(async (transaction) => {
    const [credentials] = await transaction<{ password_hash: string }[]>`
      SELECT credentials.password_hash
      FROM user_password_credentials AS credentials
      INNER JOIN users AS u ON u.id = credentials.user_id
      WHERE u.id = ${userId} AND u.status = 'active'
        AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL
      LIMIT 1
      FOR UPDATE
    `
    if (!credentials) return 'no_password'
    if (!(await Bun.password.verify(currentPassword, credentials.password_hash))) return 'invalid_password'

    const deleted = await transaction<{ id: string }[]>`
      DELETE FROM user_oauth_accounts
      WHERE user_id = ${userId} AND provider = 'google'
      RETURNING id
    `
    return deleted.length === 1 ? 'unlinked' : 'not_linked'
  })
}

export type GoogleLinkStatus = 'linked' | 'inactive' | 'email_mismatch' | 'already_linked'

/** Only links a verified Google identity to the authenticated owner of the same email. */
export async function linkGoogleAccount(userId: string, profile: GoogleProfile): Promise<GoogleLinkStatus> {
  const email = profile.email.trim().toLowerCase()
  try {
    return await db.begin(async (transaction) => {
      const [user] = await transaction<{ email: string }[]>`
        SELECT email FROM users
        WHERE id = ${userId} AND status = 'active'
          AND email_verified_at IS NOT NULL AND deleted_at IS NULL
        FOR UPDATE
      `
      if (!user) return 'inactive'
      if (user.email.trim().toLowerCase() !== email) return 'email_mismatch'

      const existing = await transaction<{ user_id: string; provider_account_id: string }[]>`
        SELECT user_id, provider_account_id FROM user_oauth_accounts
        WHERE provider = 'google'
          AND (user_id = ${userId} OR provider_account_id = ${profile.id})
      `
      if (existing.length > 0) {
        return existing.length === 1 && existing[0].user_id === userId && existing[0].provider_account_id === profile.id
          ? 'linked' : 'already_linked'
      }

      await transaction`
        INSERT INTO user_oauth_accounts (user_id, provider, provider_account_id, provider_email)
        VALUES (${userId}, 'google', ${profile.id}, ${email})
      `
      return 'linked'
    })
  } catch (error) {
    // A concurrent callback must never replace another account's Google identity.
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return 'already_linked'
    }
    throw error
  }
}
