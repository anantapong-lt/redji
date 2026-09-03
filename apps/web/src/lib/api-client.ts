import { SITE_CONFIG } from '@/site.config'

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

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
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
