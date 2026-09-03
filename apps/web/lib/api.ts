/**
 * lib/api.ts — Base API client
 *
 * หน้าที่:
 * - แนบ Authorization header ให้ทุก request อัตโนมัติ
 * - ถ้า API ตอบ 401 → ลอง refresh token ก่อน แล้วค่อย retry request เดิม
 * - ถ้า refresh ล้มเหลวด้วย → logout + redirect ไปหน้า login
 */

import { SITE_CONFIG } from '@/site.config'

const API_URL = SITE_CONFIG.apiUrl

// ─── Timeout กัน request ค้างตลอดไปแบบไม่มี error เลย ──────────────────────────
// เจอจริง (2026-08-08): endpoint ที่ path/query มีคำที่ ad blocker ใช้กรอง (เช่น "carousel",
// "sales") โดนบล็อกเงียบๆ — fetch() ไม่ reject ไม่ resolve เลย ทำให้ useQuery ค้างที่
// isLoading:true ตลอดไป ไม่มีทางไปถึง error state ที่ทำไว้แล้วได้ (ดู KNOWN_ISSUES.md) —
// ใส่ timeout ที่นี่จุดเดียว (ทุก request ผ่าน apiFetch() หมด) แทนที่จะไล่แก้ทีละ endpoint
// ที่โดนบล็อก เพราะแก้ต้นตอไม่ได้ (ควบคุม ad blocker ของผู้ใช้ไม่ได้) แต่ทำให้ fail แบบเห็นชัด
// เจาะให้ retry ได้แทนได้
const REQUEST_TIMEOUT_MS = 15_000

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

// ─── Token store ───────────────────────────────────────────────────────────────
// เก็บ access token ใน memory (module-level variable)
// AuthProvider จะเรียก tokenStore.set() หลัง login/refresh
let _token: string | null = null

export const tokenStore = {
  get: () => _token,
  set: (t: string | null) => {
    _token = t
  },
}

// ─── Refresh token ─────────────────────────────────────────────────────────────
// เรียก POST /auth/refresh โดยใช้ httpOnly cookie ที่ browser ส่งไปให้อัตโนมัติ
async function callRefresh(): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // ส่ง httpOnly refresh token cookie ไปด้วย
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data?.access_token as string) ?? null
  } catch {
    return null
  }
}

// ─── Main fetch wrapper ────────────────────────────────────────────────────────

type FetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { body, ...rest } = options

  // สร้าง headers พร้อม token
  function buildHeaders(token: string | null): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(rest.headers as Record<string, string>),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  // แปลง body เป็น JSON string ถ้ามี
  const bodyStr = body !== undefined ? JSON.stringify(body) : undefined

  // ─── Request ครั้งแรก ───────────────────────────────────────────────────────
  let res = await fetchWithTimeout(`${API_URL}${path}`, {
    ...rest,
    headers: buildHeaders(tokenStore.get()),
    body: bodyStr,
    credentials: 'include',
  })

  // ─── ถ้า 401 → ลอง refresh ─────────────────────────────────────────────────
  if (res.status === 401) {
    const newToken = await callRefresh()

    if (newToken) {
      // refresh สำเร็จ → อัปเดต token store แล้ว retry
      tokenStore.set(newToken)

      // อัปเดต cookie สำหรับ middleware ด้วย (ถ้า client-side)
      if (typeof document !== 'undefined') {
        document.cookie = `token=${newToken}; path=/; max-age=${15 * 60}; SameSite=Lax`
      }

      res = await fetchWithTimeout(`${API_URL}${path}`, {
        ...rest,
        headers: buildHeaders(newToken),
        body: bodyStr,
        credentials: 'include',
      })
    } else {
      // refresh ล้มเหลว → เคลียร์ token แล้ว redirect ไป /login
      tokenStore.set(null)
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('กรุณาเข้าสู่ระบบใหม่')
    }
  }

  // ─── Handle error responses ─────────────────────────────────────────────────
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>
    const msg = (body?.message as string) ?? `เกิดข้อผิดพลาด (${res.status})`
    throw new Error(msg)
  }

  // ─── 204 No Content ─────────────────────────────────────────────────────────
  if (res.status === 204) return null as T

  return res.json() as Promise<T>
}

// ─── Convenience methods ───────────────────────────────────────────────────────
// ใช้แทน apiFetch เพื่อให้ code อ่านง่ายขึ้น

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
