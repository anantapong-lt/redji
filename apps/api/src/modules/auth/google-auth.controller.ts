import { env } from '../../config/env'
import { isFeatureEnabled } from '../site-config/site-config.service'
import { authenticateWithGoogle, createAuthSession } from './auth.service'
import { createGoogleAuthorizationUrl, getGoogleProfile, GoogleAuthError } from './google-auth.service'

const STATE_COOKIE = env.NODE_ENV === 'production' ? '__Host-google_oauth_state' : 'google_oauth_state'
const STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 10 * 60,
}

type OAuthMode = 'login' | 'register'

type OAuthState = { state: string; verifier: string; next: string; mode: OAuthMode }

function safeNext(value: string | undefined): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/'
}

function redirectToWeb(path: string, params: Record<string, string> = {}): Response {
  const url = new URL(path, env.WEB_ORIGIN)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return Response.redirect(url, 302)
}

export async function beginGoogleAuthentication(
  mode: OAuthMode,
  next: string | undefined,
  cookie: Record<string, any>,
): Promise<Response> {
  const state = crypto.randomUUID()
  const verifier = Buffer.from(crypto.getRandomValues(new Uint8Array(48))).toString('base64url')
  const value: OAuthState = { state, verifier, next: safeNext(next), mode }
  // Cookies must contain a token-safe value. Raw JSON includes quotes and braces,
  // which some browsers/proxies do not round-trip through an OAuth redirect.
  cookie[STATE_COOKIE].set({
    value: Buffer.from(JSON.stringify(value)).toString('base64url'),
    ...STATE_COOKIE_OPTIONS,
  })
  try {
    return Response.redirect(await createGoogleAuthorizationUrl(state, verifier), 302)
  } catch (error) {
    const message = error instanceof GoogleAuthError ? error.message : 'Google authentication is unavailable.'
    return redirectToWeb('/login', { oauth_error: message })
  }
}

export async function finishGoogleAuthentication(
  query: { code?: string; state?: string; error?: string },
  cookie: Record<string, any>,
  createSession: (userId: string, role: string) => Promise<void>,
): Promise<Response> {
  const stateCookie = cookie[STATE_COOKIE]
  const rawState = stateCookie.value
  stateCookie.set({ value: '', ...STATE_COOKIE_OPTIONS, maxAge: 0, expires: new Date(0) })

  let savedState: OAuthState | null = null
  if (typeof rawState === 'string') {
    try {
      savedState = JSON.parse(Buffer.from(rawState, 'base64url').toString()) as OAuthState
    } catch { /* invalid state is rejected below */ }
  }
  const next = safeNext(savedState?.next)
  if (!savedState || !query.state || savedState.state !== query.state || !query.code || query.error) {
    return redirectToWeb('/login', { oauth_error: 'Google authentication was cancelled or expired.' })
  }

  try {
    const profile = await getGoogleProfile(query.code, savedState.verifier)
    // Google is an email-based identity provider. Both Login and Register may
    // create the account when the verified Google email does not exist yet.
    // The service handles concurrent requests through the unique email and
    // provider-account constraints, and links an existing matching email.
    const result = await authenticateWithGoogle(profile, await isFeatureEnabled('registration'))
    if ('status' in result) {
      const message = result.status === 'inactive'
        ? 'This account is not available.'
        : 'New account registration is currently unavailable.'
      return redirectToWeb('/login', { oauth_error: message })
    }
    await createSession(result.user.id, result.user.role)
    return redirectToWeb('/auth/google/callback', { next })
  } catch (error) {
    console.error('Google authentication failed', error)
    const message = error instanceof GoogleAuthError ? error.message : 'Google authentication failed. Please try again.'
    return redirectToWeb('/login', { oauth_error: message })
  }
}
