'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpen, Flag, Home, IdCard, LayoutDashboard, MonitorSmartphone, Newspaper, ScrollText, Wallet } from 'lucide-react'
import { CoinBadge, UserMenu } from '@/components/navbar'
import { WriterWalletCard } from '@/components/writer/writer-wallet-card'
import { useUser } from '@/store/auth.store'
import { useMyWriterApplication } from '@/hooks/use-writer-application'

/**
 * app/(writer)/layout.tsx
 *
 * Layout สำหรับโซนนักเขียน (/writer/*) — หน้าตาแยกจาก (main) ทั้งหมด
 * เป็น dashboard-style: sidebar ซ้าย + top bar เล็กๆ (แค่เหรียญ+avatar ไม่มี Navbar เต็ม)
 * ตรงกับภาพร่างที่ user ส่งมา ไม่ใช่ nested อยู่ใต้ (main) เพราะ chrome คนละแบบกันเลย
 *
 * Route guard ทำอยู่ที่ src/proxy.ts — ไม่ login โดน redirect ไป /login เสมอ (ทุก /writer/*)
 * ส่วน level >= 6 (นักเขียนจริง) เช็คแยกเฉพาะ /writer/works/* เท่านั้น (2026-07-30 มติแก้ —
 * user ขอให้คนทั่วไปเข้า /writer/dashboard, /writer/info ได้ด้วยเพื่อดูสถานะ/กรอกข้อมูลขอเป็น
 * นักเขียน — แต่ละหน้าเช็ค user.level เองฝั่ง client ว่าจะโชว์อะไร)
 *
 * 2026-07-30 แก้รอบ 2/3: เพิ่ม gate ฝั่ง client ที่นี่ — คนที่ยังไม่ใช่นักเขียนจริง (level < 6) และ
 * ยังไม่เคยส่งคำขอ "ข้อมูลนักเขียน" เลย (เช็คจริงจาก GET /users/me/writer-application — ดู
 * hooks/use-writer-application.ts) จะโดนเด้งไป /writer/info ทันทีไม่ว่าจะพยายามเข้าหน้าไหนใน
 * โซนนี้ก็ตาม — ตามที่ user ขอ "ต้องกรอกข้อมูล...ก่อนถึงจะไปหน้าอื่นได้" กันงงเรื่อง default เดิม
 * ที่พาไปหน้า "นิยาย" ก่อนเสมอ ทำให้คนไม่รู้ว่าต้องมากรอกข้อมูลที่นี่ — นักเขียนจริง (level >= 6)
 * ไม่โดนกระทบเลยไม่ว่าจะเคยส่งคำขอหรือยัง (กันเคสนักเขียนเก่าก่อนฟีเจอร์นี้จะมีอยู่)
 */

const NAV_LINK_CLASS =
  'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-primary-foreground/12 hover:translate-x-0.5'

export default function WriterLayout({ children }: { children: React.ReactNode }) {
  const user = useUser()
  const pathname = usePathname()
  const router = useRouter()
  const { data: application, isLoading } = useMyWriterApplication()

  useEffect(() => {
    if (!user || isLoading) return
    if ((user.level ?? 0) >= 6) return
    if (application) return
    if (pathname === '/writer/info') return
    router.replace('/writer/info')
  }, [user, isLoading, application, pathname, router])

  return (
    <>
      <div className="hidden min-h-screen bg-transparent lg:flex">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-52 shrink-0 flex-col overflow-y-auto border-r border-primary-foreground/10 bg-[linear-gradient(160deg,#3b1c21_0%,#54252b_52%,#713b44_100%)] text-primary-foreground shadow-[18px_0_45px_-38px_rgb(45_29_32_/_0.9)] md:w-60">
        <div className="px-5 py-6 text-lg font-bold">หน้านักเขียน</div>

        {/* ยอดเงินคงเหลือ + ตัวตนนักเขียน — เฉพาะนักเขียนจริง (level >= 6) เท่านั้น คนที่ยังไม่ผ่าน
            สมัครไม่มียอดขาย/รายได้ให้โชว์ — 2026-08-06 ย้ายจากล่างสุด (mt-auto) มาไว้บนสุดแทน (ใต้
            "หน้านักเขียน" เป๊ะตามที่ user ระบุ) เดิมมีบั๊กจริงด้วย: ล่างสุดพอเจอหน้าเนื้อหายาว sidebar
            ถูกยืดตาม (flex สูงเท่าเนื้อหาฝั่งขวาที่ยาวกว่า, align-items:stretch default) การ์ดที่
            mt-auto เลยหลุดพ้น viewport ต้องเลื่อนทั้งหน้าไปสุดถึงจะเห็น — ดูเหมือน "หายไป" ทั้งที่
            ยังอยู่จริง อยู่บนสุดแก้ปัญหานี้ไปในตัวเพราะเห็นได้เสมอไม่ว่าเนื้อหาจะยาวแค่ไหน */}
        {user && (user.level ?? 0) >= 6 && <WriterWalletCard user={user} />}
        <nav className="flex flex-col gap-1 px-3 py-1">
          {/* แดชบอร์ด (เดิมชื่อ "ภาพรวมนักเขียน" — 2026-08-05 rename ตาม pdf ใหม่ "ReadToon
              Creator" ที่ user ส่งมา) — สรุปยอดรวมทุกผลงาน ต่างจาก "นิยาย" ที่เป็นรายการเรื่องแยก
              ทีละเรื่อง — คง URL เดิม /writer/overview ไว้ (เปลี่ยนแค่ label ที่โชว์) เพราะ
              /writer/dashboard ถูกใช้กับหน้า "นิยาย" ไปแล้ว ชนกันไม่ได้ */}
          <Link href="/writer/overview" className={NAV_LINK_CLASS}>
            <LayoutDashboard className="size-4" />
            แดชบอร์ด
          </Link>

          <Link href="/writer/dashboard" className={NAV_LINK_CLASS}>
            <BookOpen className="size-4" />
            นิยาย
          </Link>

          <Link href="/writer/withdraw" className={NAV_LINK_CLASS}>
            <Wallet className="size-4" />
            ถอนเงิน
          </Link>

          {/* รายงานที่ได้รับ (2026-08-06, ใหม่) — จัดเป็นกลุ่ม "ใช้บ่อย" เหมือนถอนเงิน (ต้องมาเช็ค
              รายงานจากนักอ่าน/แอดมินเป็นระยะ) ต่างจากข่าวสาร/ข้อกำหนดการใช้งานด้านล่างที่เป็น
              เนื้อหาอ้างอิงเปิดดูนานๆ ครั้ง — อ้างอิงลำดับเมนูของ ReadToon Creator ที่ user ส่งมา
              (รายงานที่ได้รับอยู่ใกล้ถอนเงิน ส่วนข่าวสาร/ข้อกำหนดฯ อยู่ท้ายสุดของเมนู) */}
          <Link href="/writer/reports" className={NAV_LINK_CLASS}>
            <Flag className="size-4" />
            รายงานที่ได้รับ
          </Link>

          {/* 2026-08-05 (แก้รอบ 2): user ขอไม่ให้ดันลงล่างสุดของ aside แล้ว (ไกลเกินสายตา) —
              ให้กองรวมกับ 2 อันบนแค่มีเส้นคั่นเฉยๆ พอ ถ้ามีหมวดหมู่ใหม่เพิ่มทีหลังให้แทรกไว้ก่อน
              เส้นคั่นนี้เสมอ (ไม่ใช่แทรกต่อจาก "นิยาย" ตรงๆ) เพราะ "ข้อมูลนักเขียน"/"กลับหน้าแรก"
              เป็น 2 อันที่ใช้บ่อยน้อยกว่า ต้องอยู่ท้ายกลุ่มเสมอ */}
          <div className="my-1 border-t border-primary-foreground/15" />

          <Link href="/writer/info" className={NAV_LINK_CLASS}>
            <IdCard className="size-4" />
            ข้อมูลนักเขียน
          </Link>

          <Link href="/writer/news" className={NAV_LINK_CLASS}>
            <Newspaper className="size-4" />
            ข่าวสาร
          </Link>

          <Link href="/writer/terms" className={NAV_LINK_CLASS}>
            <ScrollText className="size-4" />
            ข้อกำหนดการใช้งาน
          </Link>

          <Link href="/" className={NAV_LINK_CLASS}>
            <Home className="size-4" />
            กลับหน้าแรก
          </Link>
        </nav>
      </aside>

      {/* Content */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-end gap-2 border-b border-border/70 bg-card/72 px-6 backdrop-blur-xl">
          {user && (
            <>
              <CoinBadge point={user.point} />
              <UserMenu />
            </>
          )}
        </header>
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
      </div>

      {/* Writer tools contain dense tables and publishing forms. Keep them off small screens until their
          mobile layout is designed, rather than exposing controls that can be used incorrectly. */}
      <main className="flex min-h-[100dvh] items-center justify-center bg-[radial-gradient(circle_at_50%_-10%,rgb(208_198_176_/_0.85),transparent_32rem)] px-5 py-10 lg:hidden">
        <section className="readji-surface w-full max-w-sm rounded-[1.75rem] p-6 text-center shadow-[0_26px_65px_-38px_rgb(45_29_32_/_0.58)]">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MonitorSmartphone className="size-7" />
          </div>
          <p className="mt-5 text-[11px] font-bold tracking-[0.16em] text-primary">WRITER STUDIO</p>
          <h1 className="mt-2 text-xl font-bold tracking-[-0.025em] text-foreground">ยังไม่รองรับบนมือถือ</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            หน้าจัดการนิยายมีตารางและแบบฟอร์มเผยแพร่ที่ยังไม่ได้ออกแบบสำหรับจอเล็ก เพื่อป้องกันข้อมูลคลาดเคลื่อน กรุณาใช้คอมพิวเตอร์หรือหน้าจอขนาดใหญ่กว่า
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Home className="size-4" />
            กลับไปอ่านนิยาย
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">ส่วนอ่านนิยายและอ่านอัตโนมัติใช้งานบนมือถือได้ตามปกติ</p>
        </section>
      </main>
    </>
  )
}
