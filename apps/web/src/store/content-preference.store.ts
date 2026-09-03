'use client'

/**
 * store/content-preference.store.ts — เมนู "การแสดงผลเนื้อหา" (ไอคอนหัวใจใน navbar, 2026-08-17)
 *
 * ปรับได้ 3 แกนอิสระต่อกัน (18+/BL/GL) แต่ละแกนมี 3 สถานะ: 'hide' (ซ่อนเนื้อหาแนวนั้นทิ้ง),
 * 'both' (โชว์ปนกับอย่างอื่นปกติ — default), 'only' (โชว์เฉพาะแนวนั้นเรื่องเดียว) — ทำงานเป็น AND
 * กันข้ามแกน (เช่น 18+='only' + bl='only' พร้อมกัน = ต้องเป็นทั้ง 18+ และติด tag BL ถึงจะโชว์)
 *
 * ผูก localStorage เหมือน age-gate.store.ts (pattern เดียวกันทุกจุด) ให้จำค่าไว้ข้ามหน้า/reload
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ContentPrefValue = 'hide' | 'both' | 'only'

interface ContentPreferenceState {
  age18: ContentPrefValue
  bl: ContentPrefValue
  gl: ContentPrefValue
  setAge18: (v: ContentPrefValue) => void
  setBl: (v: ContentPrefValue) => void
  setGl: (v: ContentPrefValue) => void
}

export const useContentPreferenceStore = create<ContentPreferenceState>()(
  persist(
    (set) => ({
      age18: 'both',
      bl: 'both',
      gl: 'both',
      setAge18: (v) => set({ age18: v }),
      setBl: (v) => set({ bl: v }),
      setGl: (v) => set({ gl: v }),
    }),
    { name: 'content-preference-storage' },
  ),
)

// ---- แปลงค่า preference → query params ของ GET /works และ GET /works/home-section ----
// (tags_all/tags_none เพิ่งเพิ่มฝั่ง backend — ดู works.service.ts GetWorksParams)
export function contentPreferenceToParams(pref: {
  age18: ContentPrefValue
  bl: ContentPrefValue
  gl: ContentPrefValue
}): { age_rate?: 'all' | '18+'; tags_all?: string[]; tags_none?: string[] } {
  const tagsAll: string[] = []
  const tagsNone: string[] = []
  if (pref.bl === 'only') tagsAll.push('BL')
  if (pref.bl === 'hide') tagsNone.push('BL')
  if (pref.gl === 'only') tagsAll.push('GL')
  if (pref.gl === 'hide') tagsNone.push('GL')

  return {
    age_rate: pref.age18 === 'hide' ? 'all' : pref.age18 === 'only' ? '18+' : undefined,
    tags_all: tagsAll.length > 0 ? tagsAll : undefined,
    tags_none: tagsNone.length > 0 ? tagsNone : undefined,
  }
}
