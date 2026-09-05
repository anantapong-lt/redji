'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface ApiUser {
  id: string
  email: string
  display_name: string
  role: string
}

interface AdminUser extends ApiUser {
  role: 'super_admin'
}

interface AuthSession {
  access_token: string
  expires_in: number
  user: ApiUser
}

interface AdminAuthContextValue {
  status: AuthStatus
  user: AdminUser | null
  accessToken: string | null
  login: (email: string, password: string, turnstileToken?: string) => Promise<void>
  logout: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)
const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(body?.message ?? 'ไม่สามารถเชื่อมต่อกับระบบได้')
  }

  return response.json() as Promise<T>
}

function isAdmin(session: AuthSession): session is AuthSession & { user: AdminUser } {
  return session.user.role === 'super_admin'
}

export function AdminAuthProvider({
  children,
  initiallyAuthenticated = false,
}: {
  children: React.ReactNode
  initiallyAuthenticated?: boolean
}) {
  const [status, setStatus] = useState<AuthStatus>(initiallyAuthenticated ? 'authenticated' : 'loading')
  const [user, setUser] = useState<AdminUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const refreshPromise = useRef<Promise<boolean> | null>(null)

  const logout = useCallback(async () => {
    try {
      await request('/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
      setAccessToken(null)
      setStatus('unauthenticated')
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!refreshPromise.current) {
      refreshPromise.current = request<AuthSession>('/auth/refresh', { method: 'POST' })
        .then(async (session) => {
          if (!isAdmin(session)) {
            await request('/auth/logout', { method: 'POST' }).catch(() => undefined)
            setUser(null)
            setAccessToken(null)
            setStatus('unauthenticated')
            return false
          }

          setUser(session.user)
          setAccessToken(session.access_token)
          setStatus('authenticated')
          return true
        })
        .catch(() => {
          setUser(null)
          setAccessToken(null)
          setStatus('unauthenticated')
          return false
        })
        .finally(() => {
          refreshPromise.current = null
        })
    }

    return refreshPromise.current
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 14 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const login = useCallback(async (email: string, password: string, turnstileToken?: string) => {
    const session = await request<AuthSession>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        ...(turnstileToken ? { turnstile_token: turnstileToken } : {}),
      }),
    })

    if (!isAdmin(session)) {
      await request('/auth/logout', { method: 'POST' }).catch(() => undefined)
      throw new Error('บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบผู้ดูแล')
    }

    setUser(session.user)
    setAccessToken(session.access_token)
    setStatus('authenticated')
  }, [])

  const value = useMemo(() => ({ status, user, accessToken, login, logout }), [accessToken, login, logout, status, user])

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext)
  if (!context) throw new Error('useAdminAuth must be used inside AdminAuthProvider')
  return context
}
