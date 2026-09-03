'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'

// useOptimisticToggle — ปุ่ม toggle (ติดตาม/ดาว/บันทึกตอน ฯลฯ) ที่ sync กลับเข้า React Query
// cache เสมอ กันบั๊ก "สลับหน้าไปมาแล้วค่าย้อนกลับ" (ดู KNOWN_ISSUES.md 2026-07-29 — 6 จุดที่เคย
// แก้มือแยกกันมี pattern เดียวกันเป๊ะ: useState + optimistic update + เรียก API + patch cache
// ทั้งตอนสำเร็จและตอน revert) รวม pattern นั้นไว้ที่เดียวให้ปุ่ม toggle ใหม่เรียกใช้แทนเขียนเอง
//
// ⚠️ ไม่ได้เอาไปแทนของเดิม 6 จุดที่แก้ไปแล้ว (novel-hero-section.tsx, episode-reader-header.tsx,
// profile-header.tsx, novel-comments-section.tsx, episode-comments-section.tsx,
// profile-bookshelf.tsx — ทดสอบผ่านครบแล้ว ไม่อยากเสี่ยงแตะของที่ทำงานถูกต้องอยู่แล้วโดยไม่จำเป็น)
// ใช้กับปุ่ม toggle ตัวใหม่ที่จะสร้างต่อไปเท่านั้น
//
// ครอบคลุมแค่รูปแบบ "boolean เดียว ผูกกับข้อมูลก้อนเดียวใน cache" (เช่น is_following,
// is_bookmarked) — ถ้าเป็น toggle ต่อรายการในลิสต์ยาวๆ (เช่น ไลค์คอมเม้นแต่ละอันในหน้าเดียว)
// ยังต้องเขียน pattern เองแบบ novel-comments-section.tsx เพราะ state shape ต่างกัน (มีหลายแถว
// พร้อมกัน ไม่ใช่ค่าเดียว)
export function useOptimisticToggle<T>({
  initialValue,
  queryKey,
  matchQueryKey = false, // true = setQueriesData (partial-match prefix, เผื่อคีย์มี pagination/filter ต่อท้ายไม่แน่นอน) / false = setQueryData (คีย์ตรงเป๊ะ)
  patch,
  onToggle,
  errorMessage,
  requireAuth = true,
}: {
  initialValue: boolean
  queryKey: QueryKey
  matchQueryKey?: boolean
  // แปลงข้อมูลเดิมในถัง cache (old) ให้เป็นค่าที่ toggle แล้ว (next) — เช่น
  // (old, next) => ({ ...old, is_following: next, stats: { ...old.stats, follower_count: old.stats.follower_count + (next ? 1 : -1) } })
  patch: (old: T, next: boolean) => T
  // เรียก API จริง (POST ตอน next=true, DELETE ตอน next=false ปกติ) — โยน error ถ้าพัง hook จะ revert ให้เอง
  onToggle: (next: boolean) => Promise<void>
  errorMessage: string
  requireAuth?: boolean
}) {
  const [value, setValue] = useState(initialValue)
  const token = useAuthStore((s) => s.token)
  const router = useRouter()
  const queryClient = useQueryClient()

  // ค่าเริ่มต้นมาจาก props/query ของหน้า อาจโหลดเสร็จทีหลัง mount (เช่นหน้าที่มีหลาย query
  // แยกกัน) — sync ทับ state ทุกครั้งที่ค่าจริงเปลี่ยน
  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  function patchCache(next: boolean) {
    if (matchQueryKey) {
      queryClient.setQueriesData<T>({ queryKey }, (old) => (old ? patch(old, next) : old))
    } else {
      queryClient.setQueryData<T>(queryKey, (old) => (old ? patch(old, next) : old))
    }
  }

  async function toggle() {
    if (requireAuth && !token) {
      router.push('/login')
      return
    }
    const was = value
    const next = !was
    setValue(next)
    patchCache(next)
    try {
      await onToggle(next)
    } catch (err: any) {
      setValue(was)
      patchCache(was)
    }
  }

  return { value, toggle }
}
