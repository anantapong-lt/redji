import { db } from '../../db'
import type { GoogleProfile } from './auth.service'

export async function getAccountSecurity(userId: string) {
  const [account] = await db<{
    email: string
    email_verified: boolean
    google_email: string | null
    google_linked_at: Date | null
  }[]>`
    SELECT u.email, u.email_verified_at IS NOT NULL AS email_verified,
      oauth.provider_email AS google_email, oauth.created_at AS google_linked_at
    FROM users AS u
    LEFT JOIN user_oauth_accounts AS oauth ON oauth.user_id = u.id AND oauth.provider = 'google'
    WHERE u.id = ${userId} AND u.status = 'active' AND u.deleted_at IS NULL
    LIMIT 1
  `
  return account ?? null
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
