'use client'

/**
 * store/auth.store.ts — Global auth state (Zustand)
 *
 * เก็บ: user object + access token
 * persist ลง localStorage key "auth-storage" → reload แล้วยังล็อกอินอยู่
 *
 * ทำไมเก็บ token ทั้งใน Zustand และ cookie?
 * - Zustand (localStorage) → ให้ React components อ่านได้
 * - Cookie `token` (non-httpOnly) → ให้ Next.js middleware อ่านได้ server-side
 *   เพื่อ redirect ก่อนที่ browser จะโหลด React เลย (เร็วกว่า + UX ดีกว่า)
 *
 * ⚠️ Cookie นี้ไม่ใช่ security gate จริง — API backend เป็น gate จริง
 *    Middleware แค่ช่วย redirect เร็วขึ้น
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SESSION_MAX_AGE, tokenStore } from '@/lib/api'
import type { User } from '@/types'

// ─── Types ──────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean

  // Actions
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void
  updateUser: (partial: Partial<User>) => void
  updatePoints: (newPoint: number) => void
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: true,

      /**
       * setAuth — เรียกหลัง login สำเร็จ หรือหลัง /auth/me ตอบกลับ
       * - เซ็ต token ใน memory (tokenStore) ให้ apiFetch ใช้
       * - เซ็ต cookie `token` ให้ middleware อ่านได้
       * - เซ็ต cookie `user_level` ให้ middleware ตรวจสิทธิ์ได้
       */
      setAuth: (user, token) => {
        tokenStore.set(token)

        // cookie นี้เป็น session hint สำหรับ proxy เท่านั้น — API ยังคงบังคับ
        // access token อายุ 15 นาที และ refresh ผ่าน httpOnly cookie
        setCookie('token', token, SESSION_MAX_AGE)

        // ให้ route gate ของนักเขียนอยู่ได้เท่ากับ session หลัก
        setCookie('user_level', String(user.level), SESSION_MAX_AGE)

        set({ user, token, isLoading: false })
      },

      /**
       * clearAuth — เรียกตอน logout หรือ refresh token หมดอายุ
       */
      clearAuth: () => {
        tokenStore.set(null)
        deleteCookie('token')
        deleteCookie('user_level')
        set({ user: null, token: null, isLoading: false })
      },

      setLoading: (isLoading) => set({ isLoading }),

      /** อัปเดตข้อมูล user บางส่วน เช่น display_name, user_img */
      updateUser: (partial) => {
        const current = get().user
        if (!current) return
        set({ user: { ...current, ...partial } })
      },

      /** อัปเดตเหรียญ — เรียกหลังซื้อตอน หรือหลังเติมเงิน */
      updatePoints: (newPoint) => {
        const current = get().user
        if (!current) return
        set({ user: { ...current, point: newPoint } })
      },
    }),

    {
      name: 'auth-storage',

      // persist เฉพาะ user กับ token (ไม่เก็บ isLoading)
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),

      // หลัง rehydrate จาก localStorage → คืน token ให้ tokenStore ด้วย
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          tokenStore.set(state.token)
        }
      },
    },
  ),
)

// ─── Selector hooks ──────────────────────────────────────────────────────────
// ใช้แทนการ destructure ทุกครั้ง — re-render เฉพาะเมื่อค่านั้นเปลี่ยน

export const useUser = () => useAuthStore((s) => s.user)
export const useToken = () => useAuthStore((s) => s.token)
export const useIsLoggedIn = () => useAuthStore((s) => Boolean(s.token && s.user))
export const useIsLoading = () => useAuthStore((s) => s.isLoading)
export const useUserLevel = () => useAuthStore((s) => s.user?.level ?? 0)
