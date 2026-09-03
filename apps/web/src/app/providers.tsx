'use client'

/**
 * app/providers.tsx — Global providers ที่ wrap ทั้ง app
 *
 * ทำหน้าที่:
 * 1. QueryClientProvider — ให้ TanStack Query ทำงานได้ทั่วทั้ง app
 * 2. AuthProvider — ตรวจสอบ session เมื่อ app โหลด (GET /auth/me)
 *    ถ้า token ใน localStorage ยัง valid → โหลด user เข้า store
 *    ถ้าหมดอายุ → ลอง refresh → ถ้าไม่ได้ → clearAuth
 */

import { useState, useEffect, useRef } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useAuthStore } from '@/store/auth.store'
import { api, tokenStore } from '@/lib/api'
import type { User } from '@/types'

// ─── QueryClient ───────────────────────────────────────────────────────────────
// สร้างนอก component เพื่อไม่ให้ re-create ทุก render
// แต่ถ้าทำ SSR ต้องสร้างใน useState เพื่อแต่ละ request มี instance ของตัวเอง

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,      // ข้อมูล fresh 1 นาที (ไม่ fetch ซ้ำถ้ายังไม่เก่า)
        retry: 1,                   // retry 1 ครั้งถ้า error
        refetchOnWindowFocus: false, // ไม่ fetch ใหม่เมื่อกลับมา focus window
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  // Server: สร้างใหม่ทุกครั้ง
  if (typeof window === 'undefined') return makeQueryClient()

  // Client: สร้างครั้งเดียว แล้วใช้ซ้ำ
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

// ─── Auth initializer ──────────────────────────────────────────────────────────

function AuthInitializer() {
  const { token, setAuth, clearAuth, setLoading } = useAuthStore()

  // ฟัง event 'auth:expired' จาก lib/api.ts — ยิงตอน refresh token ล้มเหลว
  // จาก "request ไหนก็ได้" ไม่ใช่แค่ /auth/me (เช่น /notifications ก็ยิงได้)
  // ถ้าไม่ฟังตรงนี้ user/token ใน Zustand+localStorage จะค้างเป็นของเก่าตลอดไป
  useEffect(() => {
    function handleExpired() {
      clearAuth()
    }
    window.addEventListener('auth:expired', handleExpired)
    return () => window.removeEventListener('auth:expired', handleExpired)
  }, [clearAuth])

  useEffect(() => {
    // ถ้าไม่มี token ใน localStorage → ไม่มี session → จบ
    if (!token) {
      setLoading(false)
      return
    }

    // มี token → ลอง verify กับ backend
    api
      .get<{ user: User }>('/auth/me')
      .then(({ user }) => {
        // ใช้ tokenStore.get() สดๆ แทนตัวแปร token จาก closure ของ effect นี้ — ถ้า token
        // เดิมหมดอายุพอดีตอน mount, apiFetch (lib/api.ts) จะ refresh token ใหม่ให้เงียบๆ
        // ระหว่างเรียก /auth/me แล้วเก็บลง tokenStore ทันที แต่ effect นี้ deps เป็น []
        // (รันครั้งเดียวตอน mount) เลย closure ยังจำ token เก่าที่หมดอายุแล้วอยู่ — ถ้าเรียก
        // setAuth(user, token) ตรงๆ จะทับ token ใหม่ที่เพิ่ง refresh มา กลับเป็นของเก่าอีกรอบ
        // (บั๊กจริงที่เจอจาก audit — ดู KNOWN_ISSUES.md)
        setAuth(user, tokenStore.get() ?? token)
      })
      .catch(() => {
        // token หมดอายุหรือ invalid → apiFetch ยิง 'auth:expired' ให้ clearAuth เองแล้ว
      })
      .finally(() => {
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run ครั้งเดียวตอน mount

  return null
}

// ─── Query cache reset ตอนสลับ/ออกจากบัญชี ─────────────────────────────────────
// บั๊กจริงที่ user เจอ (2026-07-30): เปิดเบราว์เซอร์เดียว login เป็น user A ดูอะไรบางอย่าง
// ที่ cache ไว้ (เช่น กระดิ่งแจ้งเตือน) แล้ว logout สลับไป login เป็น user B — React Query
// ยังคง cache เดิมของ user A ค้างไว้ (queryKey ไม่เคยผูกกับ user เลยสักจุด) โผล่ให้ user B
// เห็นข้อมูลของ user A ทันทีก่อน refetch (หรือค้างถาวรถ้า staleTime ยังไม่หมด) — เป็นบั๊กเดียวกัน
// กับที่เคย audit เจอเรื่อง "cache ค้างหลังสลับหน้า" ก่อนหน้านี้ แต่จุดนี้คือสลับ "บัญชี" แทน
// สลับ "หน้า" แก้ที่ต้นตอทีเดียวแทนที่จะไล่ผูก uuid เข้า queryKey ทุกจุด: เคลียร์ cache ทั้งหมด
// ทุกครั้งที่ identity เปลี่ยน (login ครั้งแรก, logout, หรือสลับเป็นคนละ uuid) ยกเว้นตอน mount
// รอบแรกสุด (ไม่มีอะไรให้เคลียร์ ไม่งั้นเสีย fetch เปล่าๆ)
//
// บั๊กจริงที่ user เจอเพิ่มอีกจุด (2026-08-11): "login ค้างไว้ แล้วรีเฟรชหรือเปิดหน้าแรกใหม่ ->
// เนื้อหาค้างโหลดตลอดกาล ต้องกดไปหน้าอื่นแล้วกลับมาถึงจะโผล่" — ยืนยันด้วย browser จริงแล้วว่า
// request ทุกตัวได้ 200 OK กลับมาปกติ (ไม่ใช่ backend/network ช้า) แค่ UI ไม่รับผลมาแสดง ต้นตอ:
// ตอน mount ครั้งแรกสุด (ทั้ง SSR และ paint แรกฝั่ง client) Zustand ยังไม่ทันโหลด user จาก
// localStorage เสร็จ (`persist` middleware เป็น async เสมอ แม้ storage จะเป็น localStorage ที่
// อ่านแบบ sync ก็ตาม) เลยเห็น uuid เป็น null ก่อนเสมอ — โค้ดเดิมจับ uuid ตอนนั้นเป็น baseline
// (isFirstRun) แล้วพอ rehydrate เสร็จเศษเสี้ยววินาทีถัดมา uuid เปลี่ยนจาก null เป็นของจริง ก็โดน
// ตีความว่า "สลับบัญชี" ทั้งที่ไม่ได้สลับ เรียก queryClient.clear() ไปเคลียร์ query ของหน้าแรกที่
// เพิ่งยิง request ไปพอดี — clear() ไป cancel({silent:true}) เงียบๆ ไม่แจ้ง observer เลยแม้
// request จะสำเร็จจริงก็ตาม ทำให้ useQuery ค้าง isLoading:true ถาวรจนกว่าจะ unmount/mount หน้าใหม่
// (client-side navigation ทำให้เกิด mount รอบใหม่ที่ query ไม่โดน clear ซ้ำ เลยหาย)
//
// ลองแก้รอบแรกด้วยการรอ `persist.onFinishHydration` ก่อนค่อยจับ baseline แล้ว แต่เจอว่า
// `hasHydrated()` เองก็ race กับ selector ในบาง render ได้เหมือนกัน (debug log จริงเจอ
// {hydrated:true, uuid:null} พร้อมกันในเอฟเฟกต์เดียว) เชื่อ timing ของมันไม่ได้ 100% — เปลี่ยน
// มาแก้ที่ต้นตอจริงๆ แทน: **การเปลี่ยนจาก uuid null ไปเป็นของจริง (ไม่ว่าจะเพราะเพิ่ง rehydrate
// เสร็จ หรือเพราะเพิ่ง login จริงๆ จาก guest) ไม่เคยจำเป็นต้องเคลียร์ cache เลย** เพราะตอนเป็น
// guest query ที่ผูกกับ user (เช่น /notifications ใน navbar) เป็น `enabled: isLoggedIn` เสมอ
// ไม่เคยมีข้อมูลของ user คนไหนถูก fetch/cache ไว้ให้ต้องกลัวรั่วอยู่แล้ว — เคสที่ต้องเคลียร์จริงๆ
// มีแค่ uuid จริงอันหนึ่ง เปลี่ยนเป็น uuid จริงอีกอัน (สลับบัญชี) หรือ uuid จริง เปลี่ยนเป็น null
// (logout กันเผื่อ login ใหม่เป็นคนอื่นต่อ) เท่านั้น — เขียนตามเงื่อนไขนี้ตรงๆ ไม่ต้องพึ่ง timing
// ของ hydration เลย ไม่ว่า effect จะเห็น uuid เป็น null หรือของจริงในรอบแรกก็ไม่เคลียร์อยู่ดี
function QueryCacheResetOnAuthChange() {
  const uuid = useAuthStore((s) => s.user?.uuid ?? null)
  const queryClient = useQueryClient()
  const previousUuid = useRef<string | null>(null)
  const isFirstRun = useRef(true)

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      previousUuid.current = uuid
      return
    }
    if (uuid === previousUuid.current) return

    // previousUuid เป็น null แปลว่าก่อนหน้านี้เป็น guest (หรือยัง rehydrate ไม่เสร็จ) — ไม่มี
    // ข้อมูลผูก user ค้างให้ต้องเคลียร์ เคลียร์เฉพาะตอนสลับจาก uuid จริงหนึ่งไปอีกอัน หรือ logout
    if (previousUuid.current !== null) {
      queryClient.clear()
    }
    previousUuid.current = uuid
  }, [uuid, queryClient])

  return null
}

// ─── Refetch หลัง back/forward คืนหน้าจาก bfcache ──────────────────────────────
// บั๊กจริงที่ user เจอ (2026-08-06): "รีเฟรช หรือย้อนไปย้อนมาแล้วเว็บค้าง โหลดไม่มา ต้องกดสลับหน้า
// ผ่าน link ในเว็บถึงจะหลุด" — ต้นตอ: Next.js App Router เก็บหน้าที่เคยเปิดไว้ใน client cache แล้ว
// "reuse" ตอนกดปุ่ม back/forward ของเบราว์เซอร์แทนที่จะ mount ใหม่ (ระบุไว้ใน docs เอง — "Pages
// are not cached by default but are reused during browser back/forward navigation") ถ้าตอนออก
// จากหน้านั้นไปมี query ที่ยังโหลดค้างอยู่ (เช่นสลับหน้าเร็วก่อน fetch เสร็จ) component instance
// เดิมที่ถูก "reuse" กลับมาจะยังค้างอยู่ที่ state ตอนนั้นเป๊ะ ไม่มี mount ใหม่ให้ useQuery มีโอกาส
// เช็ค/fetch ซ้ำเลย ต่างจากคลิก <Link> ในเว็บที่เป็น client-side navigation ปกติที่ query จะทำงาน
// ถูกต้อง — แก้ด้วยการฟัง browser 'pageshow' event (แยกจาก visibilitychange/focus ที่ปิดไว้แล้ว
// เพราะ refetchOnWindowFocus:false ตั้งใจไม่ให้ fetch ซ้ำตอนสลับแท็บ — pageshow ไม่ยิงตอนสลับแท็บ
// ยิงเฉพาะตอนหน้าเพิ่งถูกโหลด/คืนสภาพจริงๆ) เช็ค event.persisted === true (= คืนจาก bfcache
// เท่านั้น ไม่ใช่โหลดใหม่ปกติ) แล้ว invalidate query ที่ mount อยู่ตอนนั้นให้ fetch ใหม่ทันที
function BfcacheRefetchOnRestore() {
  const queryClient = useQueryClient()

  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        queryClient.invalidateQueries()
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [queryClient])

  return null
}

// ─── Providers component ───────────────────────────────────────────────────────

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => getQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      <QueryCacheResetOnAuthChange />
      <BfcacheRefetchOnRestore />
      {children}
      {/* Toast notifications — ใช้ toast('...') ได้ทุกที่ */}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 3000,
        }}
      />
    </QueryClientProvider>
  )
}
