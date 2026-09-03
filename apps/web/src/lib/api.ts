import { SITE_CONFIG } from '@/site.config'
import type { AuthSession } from '@/interface/auth-session.interface'
import type { AuthUser } from '@/interface/user.interface'
import type { WriterStats } from '@/interface/writer-stats.interface'

interface ApiErrorBody {
  message?: string
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const apiUrl = SITE_CONFIG.apiUrl.replace(/\/$/, '')

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null) as ApiErrorBody | null
    throw new ApiError(body?.message ?? 'ไม่สามารถเชื่อมต่อกับระบบได้', response.status)
  }

  return response.json() as Promise<T>
}

export function loginWithPassword(email: string, password: string): Promise<AuthSession> {
  return apiRequest<AuthSession>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

export function refreshAuthSession(): Promise<AuthSession> {
  return apiRequest<AuthSession>('/auth/refresh', { method: 'POST' })
}

export function logoutAuthSession(): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>('/auth/logout', { method: 'POST' })
}

export function getCurrentUser(accessToken: string): Promise<{ user: AuthUser }> {
  return apiRequest<{ user: AuthUser }>('/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export function getWriterStats(accessToken: string): Promise<{ stats: WriterStats }> {
  return apiRequest<{ stats: WriterStats }>('/writer/stats', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}
