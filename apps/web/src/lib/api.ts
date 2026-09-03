/**
 * lib/api.ts — Base API client
 *
 * ทุก request ในโปรเจกต์นี้ต้องผ่านไฟล์นี้เท่านั้น
 * ห้าม fetch() ตรงๆ ในหน้าอื่น
 *
 * ฟีเจอร์:
 * - แนบ Authorization: Bearer <token> อัตโนมัติ
 * - ถ้าได้ 401 → ลอง refresh token → retry request เดิม
 * - ถ้า refresh ไม่ได้ → clearAuth เฉยๆ (ไม่ redirect เอง — ไม่งั้น session
 *   หมดอายุตอนอยู่หน้า public เช่น Home จะโดนเด้งไป /login ทั้งที่หน้านั้นไม่ต้อง login
 *   ปล่อยให้ proxy.ts เป็นคนตัดสินใจ redirect ตอน navigate ไปหน้าที่ต้อง login จริงๆ)
 * - tokenStore เก็บ token ใน memory (ไม่ใช่ localStorage โดยตรง)
 *   เพื่อป้องกัน XSS อ่าน token ผ่าน JS
 */

import { SITE_CONFIG } from '@/site.config'

// ระยะเวลาสถานะ login ของเว็บหลัก (30 วัน) — access token จริงยังมีอายุ 15 นาที
// และทุก request ที่เจอ 401 จะขอ access token ใหม่ผ่าน httpOnly refresh cookie
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30

// ─── In-memory token store ──────────────────────────────────────────────────
// เก็บ access token ใน module-level variable
// แยกออกมาจาก Zustand เพื่อป้องกัน circular import

let _token: string | null = null

export const tokenStore = {
  get: () => _token,
  set: (t: string | null) => {
    _token = t
  },
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  /** ไม่แนบ Authorization header (ใช้สำหรับ public endpoints) */
  public?: boolean
}

// ─── Refresh Token ──────────────────────────────────────────────────────────

let _refreshPromise: Promise<string> | null = null

async function callRefresh(): Promise<string> {
  // ถ้ามี refresh อยู่แล้ว → รอ promise เดิม (ป้องกัน refresh ซ้ำพร้อมกัน)
  if (_refreshPromise) return _refreshPromise

  _refreshPromise = fetch(`${SITE_CONFIG.apiUrl}/auth/refresh`, {
    method: 'POST',
    credentials: 'include', // ส่ง httpOnly cookie (refresh token) ไปด้วย
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

// ─── Core fetch ─────────────────────────────────────────────────────────────

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { body, public: isPublic, ...rest } = options

  // FormData (upload ไฟล์) — ห้าม JSON.stringify และห้ามตั้ง Content-Type เอง
  // browser จะใส่ multipart/form-data; boundary=... ให้อัตโนมัติ
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

  // cache: 'no-store' — ทุก endpoint ในแอปนี้เป็นข้อมูล dynamic/มีการเช็คสิทธิ์ทั้งนั้น ไม่ควรให้
  // เบราว์เซอร์ cache ไว้ใช้ซ้ำเองเด็ดขาด (2026-08-05 เจอบั๊กจริง: ตอนที่เคยฟรีตอนทดสอบแล้วนักเขียน
  // มาตั้งราคาทีหลัง เบราว์เซอร์ดันเสิร์ฟเนื้อหาเก่าที่ cache ไว้ตอนยังฟรีอยู่ แทนที่จะยิงเช็คสิทธิ์ซื้อ
  // ใหม่ทุกครั้ง — GET request ทั่วไปเบราว์เซอร์มีสิทธิ์ cache ไว้เองได้ถ้าไม่มี header บอกห้ามชัดเจน)
  const res = await fetch(`${SITE_CONFIG.apiUrl}${path}`, {
    ...rest,
    headers,
    credentials: 'include',
    body: resolvedBody,
    cache: 'no-store',
  })

  // ─── 401: ลอง refresh แล้ว retry ──────────────────────────────────────
  if (res.status === 401 && !isPublic) {
    try {
      const newToken = await callRefresh()
      tokenStore.set(newToken)

      // อัปเดต session hint ให้ proxy ด้วย — อายุเท่ากับ refresh session 30 วัน
      // ตัว cookie นี้ใช้เพื่อ routing UX เท่านั้น; API ยังคงตรวจ access token 15 นาทีเสมอ
      document.cookie = `token=${newToken}; path=/; max-age=${SESSION_MAX_AGE}; SameSite=Lax`

      // Retry request เดิมด้วย token ใหม่
      const retryRes = await fetch(`${SITE_CONFIG.apiUrl}${path}`, {
        ...rest,
        headers: { ...headers, Authorization: `Bearer ${newToken}` },
        credentials: 'include',
        body: resolvedBody,
      })

      if (!retryRes.ok) throw await retryRes.json()
      return retryRes.json() as Promise<T>
    } catch {
      // refresh ล้มเหลว → เคลียร์ auth เฉยๆ ไม่ redirect เอง
      // (หน้าปัจจุบันอาจเป็น public page — ให้ proxy.ts จัดการ redirect ตอน
      // navigate ไปหน้าที่ต้อง login จริงๆ แทน ไม่ใช่บังคับเด้งจากทุกที่)
      tokenStore.set(null)
      document.cookie = 'token=; path=/; max-age=0'
      document.cookie = 'user_level=; path=/; max-age=0'
      // แจ้ง auth.store.ts ให้เคลียร์ user/token ใน Zustand+localStorage ด้วย
      // (ใช้ event แทน import store ตรงๆ เพื่อกัน circular import — ดู comment ด้านบน)
      window.dispatchEvent(new Event('auth:expired'))
      throw new Error('Session expired')
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Unknown error' }))
    throw err
  }

  // 204 No Content → ไม่มี body
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

// ─── Convenience methods ────────────────────────────────────────────────────
// ใช้แทนการเรียก apiFetch ตรงๆ — สั้นกว่า อ่านง่ายกว่า

export const api = {
  get: <T>(path: string, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),

  patch: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),

  put: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),

  delete: <T>(path: string, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
}
