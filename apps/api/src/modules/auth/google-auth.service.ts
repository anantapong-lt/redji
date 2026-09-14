import { env } from '../../config/env'
import type { GoogleProfile } from './auth.service'

const GOOGLE_AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

export class GoogleAuthError extends Error {}

export function googleOAuthEnabled(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
}

export async function createGoogleAuthorizationUrl(state: string, codeVerifier: string): Promise<string> {
  if (!googleOAuthEnabled()) throw new GoogleAuthError('Google sign-in is not configured')
  const url = new URL(GOOGLE_AUTHORIZATION_URL)
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID)
  url.searchParams.set('redirect_uri', new URL('/auth/google/callback', env.API_ORIGIN).toString())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  url.searchParams.set('code_challenge', Buffer.from(hash).toString('base64url'))
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('prompt', 'select_account')
  return url.toString()
}

export async function getGoogleProfile(code: string, codeVerifier: string): Promise<GoogleProfile> {
  if (!googleOAuthEnabled()) throw new GoogleAuthError('Google sign-in is not configured')
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: new URL('/auth/google/callback', env.API_ORIGIN).toString(),
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  })
  const tokens = await tokenResponse.json().catch(() => null) as { access_token?: string } | null
  if (!tokenResponse.ok || !tokens?.access_token) throw new GoogleAuthError('Google authorization could not be completed')

  const profileResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = await profileResponse.json().catch(() => null) as {
    sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string
  } | null
  if (!profileResponse.ok || !profile?.sub || !profile.email || profile.email_verified !== true) {
    throw new GoogleAuthError('Google account email must be verified')
  }
  return { id: profile.sub, email: profile.email, name: profile.name ?? profile.email, picture: profile.picture }
}
