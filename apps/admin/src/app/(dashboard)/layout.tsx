'use client'

/**
 * app/(dashboard)/layout.tsx — Layout หลักของแอป Admin (sidebar + top bar)
 *
 * ครอบด้วย AdminGuard ทั้งก้อน — ไม่ login หรือ level < 8 จะโดนเด้งไป /login ทันที (ดู
 * components/admin-guard.tsx สำหรับเหตุผลว่าทำไมนี่เป็นแค่ UX shortcut ไม่ใช่ security gate จริง)
 *
 * โครงสร้างแท็บตามสเปค 9 ข้อ (2026-08-03) — **เลขหลักในสเปค = แท็บแยกกันเด็ดขาด ห้ามยัดรวม**
 * (ต่างจากรอบก่อนที่พลาดเอา Flag queue ไปแปะไว้ในหน้า "จัดการผู้ใช้" ผิดที่ — แก้แล้ว):
 * 1. "ตั้งหน้าเว็บไซต์" (ข้อ 8 ในสเปค — ย้ายมาอยู่แรกสุดตามที่ user ขอ "ควรขยับไปอันแรก")
 * 2. "Analytic" (ข้อ 1) — โครงว่างรอกราฟ ล็อก level 8 ทั้งหมด
 * 3. "จัดการผู้ใช้" (ข้อ 2)
 * 4. "นักเขียน" (ข้อ 3 — ของเดิมที่มีอยู่แล้ว)
 * 5. "ผลงาน" (ข้อ 4) — โครงว่าง รอทำ
 * 6. "รายงาน" (ข้อ 5) — Flag queue จากข้อ 2.1 ย้ายมาอยู่ตรงนี้แล้ว
 * 7. "หน่วยรบ" (ข้อ 6) — โครงว่าง ตกลงกันแล้วว่าทำท้ายสุด
 * 8. "ข้อมูลบัญชีแอดมิน" (ข้อ 7) — ข้อมูลบัญชีตัวเอง + เลื่อนขั้นแอดมิน/แบน
 * 9. "ตั้งค่า" (ข้อ 9) — โครงว่าง level 10 เท่านั้น
 *
 * 2026-08-04: ตัดแท็บ "จัดการสิทธิ์" (ของเดิม ไม่ใช่ 1 ใน 9 ข้อ) ทิ้งแล้ว — user ทักว่าซ้ำซ้อนกับ
 * หน้านักเขียน (ทั้งคู่เลื่อนขั้น 1↔6 ได้) เลยรวมเป็นทางเดียว: **เลื่อนขั้น (1→6) ทำได้ทางเดียวผ่าน
 * "นักเขียน > รอยืนยันสิทธิ์" (ต้องมีใบสมัคร/ข้อมูลบัญชีธนาคารจริงเท่านั้น ไม่มีทาง bypass อีก)
 * ส่วนถอดถอน (6→1) ย้ายเข้าไปอยู่ในปุ่ม "ดูเพิ่มเติม" ของแต่ละแถวใน "นักเขียน > นักเขียนของเว็บ" แทน
 * (ดู writers/page.tsx + components/writers/writer-detail-modal.tsx)
 *
 * 2026-08-04: เพิ่มแท็บ "จัดการธุรกรรม" (อนุมัติ/ปฏิเสธคำขอถอนเงินนักเขียนโดยเฉพาะ — ผูกกับ
 * backend listWithdrawals/approveWithdrawal/rejectWithdrawal ที่มีอยู่แล้วแต่ไม่เคยมี UI) เข้าได้
 * เฉพาะ level >= 9 (user ยืนยันให้ level 10 เข้าได้ด้วยตามรูปแบบเดิมของทั้งระบบ)
 *
 * 2026-08-04: เปลี่ยน mindset การล็อกสิทธิ์ — เดิมทุกแท็บโชว์ใน sidebar หมดแม้ level ไม่พอ (คลิกเข้า
 * ไปแล้วค่อยเจอข้อความบล็อกในหน้า) ตอนนี้ **แท็บที่ level ปัจจุบันเข้าไม่ได้จะไม่โชว์ใน sidebar เลย**
 * (กรองด้วย `minLevel` ต่อรายการ) — แต่ละหน้ายังคงเช็ค level ซ้ำอีกชั้นไว้เป็น fallback เผื่อเข้าทาง
 * URL ตรงๆ (defense in depth เดียวกับที่ AdminGuard คอมเมนต์ไว้ด้านบน — client-side ไม่ใช่ security
 * gate จริง ตัวบังคับจริงคือ backend)
 *
 * 2026-08-04: เพิ่ม 2 แท็บใหม่
 * - "ข้อความติดต่อ" — แชท/รับข้อความจากนักอ่าน-นักเขียนที่ติดต่อเข้ามานอกเหนือจากระบบรายงาน
 *   ตาม user บอก "ไม่ต้องรีบทำ" เลยทำเป็น placeholder ไว้ก่อน (minLevel 8 เหมือนรายงาน — งานรับ
 *   เรื่องเข้ามาด่านหน้าแบบเดียวกัน)
 * - "ประวัติ" — audit log ทุก action ในระบบหลังบ้าน ต่อ backend จริงเลยตามที่ user ขอ (ดู
 *   history/page.tsx) — minLevel 9 ตรงกับที่ backend (admin.routes.ts) เช็คอยู่แล้ว
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutTemplate, BarChart3, Users, PenSquare,
  BookOpen, Flag, Swords, UserCog, Settings, Banknote, MessageSquare, History, Volume2,
} from 'lucide-react'
import { AdminGuard } from '@/components/admin-guard'
import { useAuthStore, useAdminUser } from '@/store/auth.store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/site', label: 'ตั้งหน้าเว็บไซต์', icon: LayoutTemplate, minLevel: 9 },
  { href: '/analytics', label: 'Analytic', icon: BarChart3, minLevel: 8 },
  { href: '/users', label: 'จัดการผู้ใช้', icon: Users, minLevel: 8 },
  { href: '/writers', label: 'นักเขียน', icon: PenSquare, minLevel: 8 },
  { href: '/works', label: 'ผลงาน', icon: BookOpen, minLevel: 9 },
  { href: '/tts-requests', label: 'คำขอใช้ TTS', icon: Volume2, minLevel: 8 },
  { href: '/reports', label: 'รายงาน', icon: Flag, minLevel: 8 },
  { href: '/messages', label: 'ข้อความติดต่อ', icon: MessageSquare, minLevel: 8 },
  { href: '/squad', label: 'หน่วยรบ', icon: Swords, minLevel: 9 },
  { href: '/admin-account', label: 'ข้อมูลบัญชีแอดมิน', icon: UserCog, minLevel: 8 },
  { href: '/transactions', label: 'จัดการธุรกรรม', icon: Banknote, minLevel: 9 },
  { href: '/history', label: 'ประวัติ', icon: History, minLevel: 9 },
  { href: '/settings', label: 'ตั้งค่า', icon: Settings, minLevel: 10 },
] as const

function DashboardShell({ children }: { children: React.ReactNode }) {
  const user = useAdminUser()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const pathname = usePathname()

  async function handleLogout() {
    try {
      await api.post('/auth/logout')
    } catch {
      // ไม่สนใจ error ตอน logout — ยังไง client state ก็ clear อยู่ดี
    } finally {
      clearAuth()
    }
  }

  return (
    <div className="flex min-h-screen bg-transparent">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-primary-foreground/10 bg-[linear-gradient(160deg,#3b1c21_0%,#54252b_52%,#713b44_100%)] text-primary-foreground shadow-[18px_0_45px_-38px_rgb(45_29_32_/_0.9)]">
        <div className="border-b border-primary-foreground/12 px-5 py-6">
          <p className="text-[10px] font-bold tracking-[0.16em] text-primary-foreground/55">CONTROL CENTER</p>
          <div className="mt-1 flex items-center gap-2 text-xl font-extrabold tracking-[-0.035em]">Readji Admin</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.filter((item) => (user?.level ?? 0) >= item.minLevel).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-primary-foreground/10',
                pathname?.startsWith(href) && 'bg-primary-foreground/15 shadow-[inset_3px_0_0_rgb(255_255_255_/_0.85)]',
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        {user && (
          <div className="mx-3 mb-4 rounded-xl border border-primary-foreground/12 bg-primary-foreground/7 px-3 py-2.5 text-xs text-primary-foreground/70">
            level {user.level}
          </div>
        )}
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-end gap-3 border-b border-border/70 bg-card/72 px-6 backdrop-blur-xl">
          {user && <span className="rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">{user.display_name}</span>}
          <button
            type="button"
            onClick={handleLogout}
            className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            ออกจากระบบ
          </button>
        </header>
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <DashboardShell>{children}</DashboardShell>
    </AdminGuard>
  )
}
