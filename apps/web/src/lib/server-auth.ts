import 'server-only'

import { cookies } from 'next/headers'
import type { AuthUser } from '@/interface/user.interface'
import { SITE_CONFIG } from '@/site.config'

function serverApiUrl(): string {
  const url = new URL(SITE_CONFIG.apiUrl, SITE_CONFIG.siteUrl)
  return url.toString().replace(/\/$/, '')
}

export async function getServerAuthUser(): Promise<AuthUser | null> {
  const cookieHeader = (await cookies()).toString()
  if (!cookieHeader) return null

  try {
    const response = await fetch(`${serverApiUrl()}/auth/session`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Cookie: cookieHeader,
      },
    })

    if (!response.ok) return null

    const body = await response.json() as { user: AuthUser }
    return body.user
  } catch {
    return null
  }
}

export async function getServerUnreadNotificationCount(): Promise<number> {
  const cookieHeader = (await cookies()).toString()
  if (!cookieHeader) return 0

  try {
    const response = await fetch(`${serverApiUrl()}/notifications/unread-count`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Cookie: cookieHeader,
      },
    })

    if (!response.ok) return 0

    const body = await response.json() as { count?: number }
    return typeof body.count === 'number' ? body.count : 0
  } catch {
    return 0
  }
}
