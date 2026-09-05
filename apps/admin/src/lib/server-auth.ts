import 'server-only'

import { cookies } from 'next/headers'

interface AdminSessionUser {
  role: string
}

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

export async function getServerAdminUser(): Promise<AdminSessionUser | null> {
  const cookieHeader = (await cookies()).toString()
  if (!cookieHeader) return null

  try {
    const response = await fetch(`${apiUrl}/auth/session`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Cookie: cookieHeader,
      },
    })

    if (!response.ok) return null

    const body = await response.json() as { user?: AdminSessionUser }
    return body.user?.role === 'super_admin' ? body.user : null
  } catch {
    return null
  }
}
