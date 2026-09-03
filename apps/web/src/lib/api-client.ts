import { SITE_CONFIG } from '@/site.config'

interface ApiErrorBody {
  message?: string
  field?: string
}

interface ApiRequestOptions extends RequestInit {
  accessToken?: string | null
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const apiUrl = SITE_CONFIG.apiUrl.replace(/\/$/, '')

export async function apiRequest<T>(path: string, init?: ApiRequestOptions): Promise<T> {
  const {
    accessToken,
    headers: requestHeaders,
    ...requestInit
  } = init ?? {}
  const headers = new Headers(requestHeaders)

  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  const response = await fetch(`${apiUrl}${path}`, {
    ...requestInit,
    credentials: 'include',
    headers,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null) as ApiErrorBody | null
    throw new ApiError(
      body?.message ?? 'ไม่สามารถเชื่อมต่อกับระบบได้',
      response.status,
      body?.field,
    )
  }

  return response.json() as Promise<T>
}
