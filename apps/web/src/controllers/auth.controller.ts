import { apiRequest } from '@/lib/api-client'
import type { AuthSession } from '@/interface/auth-session.interface'
import type { AuthUser } from '@/interface/user.interface'
import type { AccountSecurity, ChangePasswordInput } from '@/interface/account-security.interface'

export function changePassword(input: ChangePasswordInput, accessToken: string): Promise<{ message: string }> {
  return apiRequest('/auth/security/password', {
    method: 'POST',
    accessToken,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function getAccountSecurity(accessToken: string): Promise<{ account: AccountSecurity }> {
  return apiRequest('/auth/security', { accessToken })
}

export interface RegisterWithPasswordInput {
  username: string
  email: string
  password: string
  turnstile_token?: string
}

export function registerWithPassword(
  input: RegisterWithPasswordInput,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function verifyRegistrationEmail(token: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
}

export function loginWithPassword(
  email: string,
  password: string,
  turnstileToken?: string,
): Promise<AuthSession> {
  return apiRequest<AuthSession>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      ...(turnstileToken ? { turnstile_token: turnstileToken } : {}),
    }),
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
    accessToken,
  })
}
