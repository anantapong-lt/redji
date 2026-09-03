import { apiRequest } from '@/lib/api-client'
import type { AuthSession } from '@/interface/auth-session.interface'
import type { AuthUser } from '@/interface/user.interface'

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
