'use client'

/**
 * app/(main)/become-writer/page.tsx — หน้าเตือน+ขอเป็นนักเขียน (2026-07-30)
 *
 * โชว์ให้ user ที่ login แล้วแต่ level ไม่ถึง 6 (ไม่ใช่นักเขียน) เจอตอนพยายามเข้า /writer/*
 * (proxy.ts เด้งมาที่นี่แทนที่จะเด้งกลับ "/" เงียบๆ เหมือนเดิม) — ต้องติ๊ก checkbox ยืนยัน +
 * กรอกข้อความแนะนำตัวก่อน ถึงจะกดปุ่ม "ยืนยันตัวตน" ได้
 *
 * 2026-07-30 มติแก้: กดยืนยันตัวตนแล้วพาเข้าโซนนักเขียนทันที (router.push('/writer/info'))
 * แทนที่จะโชว์ข้อความสำเร็จค้างอยู่หน้านี้ — ตามที่ user ขอ ("พอกดยืนยันปุ๊ปมันจะเข้ามาหน้า
 * นักเขียนเลยได้ไหม")
 *
 * ⚠️ ทั้งหน้านี้เป็น mock ทั้งหมด (ตามที่ user บอกชัดเจน "ให้ Mock ไว้ก่อนแล้วเดี๋ยวเรามาคุยเรื่อง
 * เลเวลกัน") — ปุ่ม "ยืนยันตัวตน" ไม่ได้เปลี่ยน level จริง ไม่มี backend รองรับเลยตอนนี้ (ดู
 * KNOWN_ISSUES.md หัวข้อ "ระบบขอสิทธิ์เป็นนักเขียน" ที่ flag scope นี้ไว้ตั้งแต่ก่อนหน้านี้แล้ว)
 * Cloudflare ด้านล่างก็ mock เช่นกัน (CloudflarePlaceholder) — ยังไม่ได้ต่อ Turnstile จริง
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CloudflarePlaceholder } from '@/components/auth/cloudflare-placeholder'

const INTRO_MAX = 500

export default function BecomeWriterPage() {
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [intro, setIntro] = useState('')

  const canSubmit = agreed && intro.trim().length > 0

  function handleSubmit() {
    if (!canSubmit) return
    // mock — ยังไม่มี backend/ระบบอนุมัติจริงรองรับตอนนี้
    router.push('/writer/info')
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-4 py-20 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <TriangleAlert className="size-8" />
      </div>

      <div>
        <h1 className="mb-2 text-xl font-bold text-foreground">หน้านี้สำหรับนักเขียนเท่านั้น</h1>
        <p className="text-sm text-muted-foreground">
          หน้านี้มีไว้สำหรับนักเขียนเท่านั้น หากท่านไม่ได้กดพลาดและต้องการเป็นนักเขียนกับทางเรา
          จำเป็นต้องยืนยันตัวตน
        </p>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground select-none">
        <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
        ต้องการเป็นนักเขียน
      </label>

      <div className="w-full text-left">
        <label className="mb-1.5 block text-sm font-medium text-foreground">ข้อความแนะนำตัว</label>
        <textarea
          value={intro}
          onChange={(e) => setIntro(e.target.value.slice(0, INTRO_MAX))}
          maxLength={INTRO_MAX}
          rows={4}
          placeholder="แนะนำตัวเองสั้นๆ ให้ทีมงานรู้จัก..."
          className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {intro.length}/{INTRO_MAX}
        </p>
      </div>

      <div className="w-full">
        <CloudflarePlaceholder />
      </div>

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Button disabled={!canSubmit} onClick={handleSubmit} className="rounded-lg">
          ยืนยันตัวตน
        </Button>
        <Link
          href="/"
          className="flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          ไม่ใช่ กลับหน้าแรก
        </Link>
      </div>
    </div>
  )
}
