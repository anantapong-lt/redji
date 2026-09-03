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
import {
  type AuthSession,
  type AuthUser,
  loginWithPassword,
  logoutAuthSession,
  refreshAuthSession,
} from '@/lib/api'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  accessToken: string | null
  user: AuthUser | null
  status: AuthStatus
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const refreshPromise = useRef<Promise<AuthSession | null> | null>(null)

  const refresh = useCallback(async () => {
    if (!refreshPromise.current) {
      refreshPromise.current = refreshAuthSession()
        .then((nextSession) => {
          setSession(nextSession)
          setStatus('authenticated')
          return nextSession
        })
        .catch(() => {
          setSession(null)
          setStatus('unauthenticated')
          return null
        })
        .finally(() => {
          refreshPromise.current = null
        })
    }

    return (await refreshPromise.current) !== null
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!session) return

    const refreshIn = Math.max(session.expires_in - 60, 1) * 1000
    const timer = window.setTimeout(() => void refresh(), refreshIn)
    return () => window.clearTimeout(timer)
  }, [refresh, session])

  const login = useCallback(async (email: string, password: string) => {
    const nextSession = await loginWithPassword(email, password)
    setSession(nextSession)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutAuthSession()
    } catch {
      // The local session must still be removed if the API is unavailable.
    } finally {
      setSession(null)
      setStatus('unauthenticated')
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    accessToken: session?.access_token ?? null,
    user: session?.user ?? null,
    status,
    login,
    logout,
    refresh,
  }), [login, logout, refresh, session, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
