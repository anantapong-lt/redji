'use client'

/**
 * store/auth.store.ts — Global auth state ของแอป Admin (Zustand)
 *
 * เหมือน apps/web/src/store/auth.store.ts ในหลักการ แต่เก็บ access token ไว้ใน memory
 * เท่านั้น (ไม่มี persist/localStorage/cookie) เพื่อให้เปิดหรือรีโหลด Admin ใหม่ต้อง login
 * ใหม่ทุกครั้ง แม้เว็บหลักจะจดจำ session ได้ 30 วัน
 */

import { create } from 'zustand'
import { tokenStore } from '@/lib/api'
import type { AdminSelf } from '@/types'

interface AuthState {
  user: AdminSelf | null
  token: string | null
  isLoading: boolean

  setAuth: (user: AdminSelf, token: string) => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: (user, token) => {
    tokenStore.set(token)
    set({ user, token, isLoading: false })
  },

  clearAuth: () => {
    tokenStore.set(null)
    set({ user: null, token: null, isLoading: false })
  },

  setLoading: (isLoading) => set({ isLoading }),
}))

export const useAdminUser = () => useAuthStore((s) => s.user)
// 2026-07-30 มติเลเวล: 8=แอดมินย่อย, 9=แอดมินรอง, 10=shareholder — เข้าแอปนี้ได้ตั้งแต่ level 8
export const useIsLoggedInAsAdmin = () =>
  useAuthStore((s) => Boolean(s.token && s.user && s.user.level >= 8))
export const useIsAuthLoading = () => useAuthStore((s) => s.isLoading)
