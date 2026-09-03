'use client'

/**
 * app/providers.tsx — Global providers (Admin)
 *
 * เหมือน apps/web/src/app/providers.tsx ในหลักการ: QueryClientProvider +
 * ตรวจ session ตอน app โหลดผ่าน GET /auth/me (endpoint ทั่วไป ใช้ร่วมกับ apps/web ได้เลย
 * ไม่ต้องมี endpoint แยกสำหรับ admin) — ถ้า user ที่ login ไว้ level < 9 จะโดน AdminGuard
 * เด้งออกอีกที (ดู components/admin-guard.tsx)
 */

import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { api, tokenStore } from '@/lib/api'
import type { AdminSelf } from '@/types'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

function AuthInitializer() {
  const { token, setAuth, clearAuth, setLoading } = useAuthStore()

  useEffect(() => {
    function handleExpired() {
      clearAuth()
    }
    window.addEventListener('auth:expired', handleExpired)
    return () => window.removeEventListener('auth:expired', handleExpired)
  }, [clearAuth])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    api
      .get<{ user: AdminSelf }>('/auth/me')
      .then(({ user }) => {
        setAuth(user, tokenStore.get() ?? token)
      })
      .catch(() => {
        // token หมดอายุ/invalid — apiFetch ยิง 'auth:expired' ให้ clearAuth เองแล้ว
      })
      .finally(() => {
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

// ล้าง access token รุ่นเก่าที่ Admin เคย persist ลง localStorage ก่อนนโยบาย
// "เปิด Admin ใหม่ต้อง login ใหม่" จะถูกใช้จริง ไม่เก็บหรือส่ง token นี้ไปที่ใด
function ClearLegacyAdminSession() {
  useEffect(() => {
    window.localStorage.removeItem('admin-auth-storage')
  }, [])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => getQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <ClearLegacyAdminSession />
      <AuthInitializer />
      {children}
    </QueryClientProvider>
  )
}
