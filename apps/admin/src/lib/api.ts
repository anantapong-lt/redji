/**
 * lib/api.ts — Base API client (Admin)
 *
 * เหมือนกับ apps/web/src/lib/api.ts ทุกประการในหลักการ (ยิงไป apps/api ตัวเดียวกัน)
 * ต่างแค่ไม่มีการเขียน cookie `token`/`user_level` เพราะแอปนี้ไม่มี proxy.ts/middleware
 * แบบ apps/web — ป้องกันฝั่ง client ด้วย AdminGuard component แทน (ดู components/admin-guard.tsx)
 * ส่วนป้องกันจริงยังเป็น backend (`admin.routes.ts`, level >= 9) เหมือนเดิม
 */

import { SITE_CONFIG } from '@/site.config'

let _token: string | null = null

export const tokenStore = {
  get: () => _token,
  set: (t: string | null) => {
    _token = t
  },
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  public?: boolean
}

let _refreshPromise: Promise<string> | null = null

async function callRefresh(): Promise<string> {
  if (_refreshPromise) return _refreshPromise

  _refreshPromise = fetch(`${SITE_CONFIG.apiUrl}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then(async (res) => {
      if (!res.ok) throw new Error('refresh failed')
      const data = await res.json()
      return data.access_token as string
    })
    .finally(() => {
      _refreshPromise = null
    })

  return _refreshPromise
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { body, public: isPublic, ...rest } = options

  // FormData (อัปโหลดไฟล์ เช่น cover ผลงานในแท็บ "ผลงาน") — ห้าม JSON.stringify และห้ามตั้ง
  // Content-Type เอง ให้ browser ใส่ multipart/form-data; boundary=... ให้อัตโนมัติ
  // (2026-08-04, พอร์ต fix เดียวกับ apps/web/src/lib/api.ts มา — เดิม apps/admin ไม่เคยมี
  // ฟีเจอร์อัปโหลดไฟล์เลยไม่เคยเจอบั๊กนี้)
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(rest.headers as Record<string, string>),
  }

  const token = tokenStore.get()
  if (token && !isPublic) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const resolvedBody = body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body)

  const res = await fetch(`${SITE_CONFIG.apiUrl}${path}`, {
    ...rest,
    headers,
    credentials: 'include',
    body: resolvedBody,
  })

  if (res.status === 401 && !isPublic) {
    try {
      const newToken = await callRefresh()
      tokenStore.set(newToken)

      const retryRes = await fetch(`${SITE_CONFIG.apiUrl}${path}`, {
        ...rest,
        headers: { ...headers, Authorization: `Bearer ${newToken}` },
        credentials: 'include',
        body: resolvedBody,
      })

      if (!retryRes.ok) throw await retryRes.json()
      return retryRes.json() as Promise<T>
    } catch {
      tokenStore.set(null)
      window.dispatchEvent(new Event('auth:expired'))
      throw new Error('Session expired')
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Unknown error' }))
    throw err
  }

  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),

  patch: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
}
