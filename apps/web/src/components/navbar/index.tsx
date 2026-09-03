'use client'

/**
 * components/navbar/index.tsx — Navbar หลักของเว็บ
 *
 * มี:
 * - Logo + เมนู (หน้าแรก / ฟีด / ประวัติ) — active state (ข้อความสี primary) ตาม path ปัจจุบัน
 * - ค้นหา (ไอคอน → ลิงก์ไปหน้า /search แยกต่างหาก สำหรับค้นแบบละเอียด)
 * - ปากกา (โหมดนักเขียน)
 * - Notification bell → popup เล็กๆ ทับหน้า (ไม่ redirect ไปหน้าใหม่)
 *   guest เห็น prompt ให้ login แทนรายการจริง
 * - Avatar + dropdown menu (profile, logout) หรือปุ่ม "เข้าสู่ระบบ" ถ้ายังไม่ login
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Rss, History, Search, PenLine, Bell, Coins, LogIn, Menu, MessageCircle, UserRound, UsersRound, X } from 'lucide-react'
import { useAuthStore, useUser, useIsLoggedIn } from '@/store/auth.store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { ContentPreferenceMenu } from './content-preference-menu'
import { RedeemCodeMenuItem } from './redeem-code-menu-item'
import { RedeemCodeDialog } from '@/components/redeem/redeem-code-dialog'
import { captureReferralCodeFromUrl } from '@/lib/referral-code'
import type { Notification } from '@/types'

// ─── Coin Badge ────────────────────────────────────────────────────────────────

export function CoinBadge({ point, compact = false }: { point: number; compact?: boolean }) {
  return (
    <Link
      href="/topup"
      aria-label={`เหรียญ ${point.toLocaleString()}`}
      className={cn(
        'flex items-center rounded-full border border-amber-200/80 bg-amber-50/90 text-sm font-semibold text-amber-700 shadow-sm transition-all hover:-translate-y-px hover:bg-amber-100',
        compact ? 'gap-1 px-2 py-1.5 text-xs' : 'gap-1.5 px-3 py-1.5',
      )}
    >
      <svg className="size-4 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" />
        <text x="12" y="16" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">
          ฿
        </text>
      </svg>
      {/* min-w พอสำหรับเลข 4 หลัก (เช่น 9,999) ยืดได้ถ้าเกิน แต่มี max-w กันไม่ให้ยืดจนดันของด้านซ้าย
          เกิน max-w (เกินแสน) ให้ตัดด้วย ellipsis แทน — ในทางปฏิบัติไม่น่าเกิดขึ้นจริง */}
      <span className={cn(
        'inline-block overflow-hidden text-right text-ellipsis whitespace-nowrap',
        compact ? 'min-w-5 max-w-10' : 'min-w-14 max-w-20',
      )}>
        {point.toLocaleString()}
      </span>
    </Link>
  )
}

// ─── Nav Pills ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/', label: 'หน้าแรก', icon: Home },
  { href: '/feed', label: 'ฟีด', icon: Rss },
  { href: '/history', label: 'ประวัติ', icon: History },
]

// "ใช้โค้ด" ไม่อยู่ในลิสต์นี้แล้ว (2026-08-18) — เดิม Link ธรรมดาไป /redeem-code (dead link) ตอนนี้
// เปิด RedeemCodeDialog แทน + ต้อง highlight ได้เมื่อมีโบนัสค้างอยู่ เลยแยกเป็น RedeemCodeMenuItem
// component ต่างหาก แทรกเข้าไปในตำแหน่งเดิมด้วยมือทั้ง desktop dropdown (UserMenu) และ mobile drawer
const ACCOUNT_NAV_ITEMS_BEFORE_REDEEM = [
  { href: '/profile', label: 'โปรไฟล์', icon: UserRound },
  { href: '/purchase-history', label: 'ประวัติการซื้อ', icon: History },
]
const ACCOUNT_NAV_ITEMS_AFTER_REDEEM = [
  { href: '/writer/dashboard', label: 'หน้านักเขียน', icon: PenLine, desktopOnly: true },
  { href: '/referral', label: 'ชวนเพื่อน', icon: UsersRound },
  { href: '/contact-admin', label: 'ติดต่อแอดมิน', icon: MessageCircle },
]

function NavPills() {
  const pathname = usePathname()

  return (
    <nav className="hidden items-center gap-1.5 text-sm font-medium md:flex">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all duration-200',
              active
                ? 'text-primary'
                : 'text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-sm',
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

// ─── Search (ไปหน้าค้นหาแยก — filter ละเอียดอยู่ในหน้านั้น) ────────────────────

function SearchLink() {
  return (
    <Link
      href="/search"
      aria-label="ค้นหา"
      className="readji-icon-button"
    >
      <Search className="size-5" />
    </Link>
  )
}

// ─── Notification Bell ─────────────────────────────────────────────────────────

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const isLoggedIn = useIsLoggedIn()

  const { data: notifications = [], refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ data: Notification[] }>('/notifications').then((r) => r.data),
    enabled: isLoggedIn,
    staleTime: 30_000, // refresh ทุก 30 วินาที
    // 2026-08-09: เจอเคสจริงที่ request แรกหลัง login โดน 401 แล้วแม้ apiFetch() จะ refresh
    // token แล้ว retry ให้อัตโนมัติอยู่แล้ว (ดู lib/api.ts) retry นั้นก็ยังโดน 401 ซ้ำอีกรอบ
    // (เช็ค backend/retry logic แล้วไม่เจอจุดผิดที่ฟันธงได้ 100% — เข้าข่ายเป็นผลพวงของ session
    // ที่ผ่านการสลับบัญชี/refresh token ชนกันมาก่อนหน้านั้นมากกว่า) — ผลคือกระดิ่งค้างว่างเปล่าไม่มี
    // ทางรู้เลยว่ามีแจ้งเตือนจริงจนกว่าจะ refresh หน้าเอง เพราะ useQuery หยุด retry เองหลังพังครั้งแรก
    // เพิ่ม refetchInterval ให้ลองใหม่เป็นระยะแทน กันไม่ให้ค้างพังถาวรจากเหตุชั่วคราวแบบนี้อีก
    refetchInterval: isLoggedIn ? 30_000 : false,
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all')
      refetch()
    } catch {
      // ไม่ต้อง toast เพราะเป็น background action
    }
  }

  function handleClick() {
    // guest ก็เปิด popup เล็กๆ ได้เหมือนกัน — แค่ไม่มีรายการจริงให้ดู (ไม่ redirect ไปหน้าใหม่)
    setOpen((v) => !v)
    if (!open && isLoggedIn && unreadCount > 0) markAllRead()
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="readji-icon-button relative cursor-pointer"
        aria-label="การแจ้งเตือน"
      >
        <Bell className="size-5" />

        {isLoggedIn && unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="readji-surface absolute right-0 top-full z-20 mt-3 w-80 overflow-hidden rounded-2xl shadow-[0_24px_54px_-28px_rgb(45_29_32_/_0.5)]">
            <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
              การแจ้งเตือน
            </div>

            {!isLoggedIn ? (
              <div className="p-4 text-center">
                <p className="mb-3 text-sm text-muted-foreground">
                  เข้าสู่ระบบเพื่อดูการแจ้งเตือน
                </p>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="inline-block rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  เข้าสู่ระบบ
                </Link>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">ไม่มีการแจ้งเตือน</p>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <a
                      key={n.id}
                      href={n.ref_url ?? '#'}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'block border-b border-border/60 px-4 py-3 text-sm transition-colors last:border-0 hover:bg-accent',
                        !n.is_read && 'bg-accent/50',
                      )}
                    >
                      <p className="leading-snug text-foreground">{n.message}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </a>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── User Avatar Menu ──────────────────────────────────────────────────────────

export function UserMenu({ mobile = false, hideLogout = false }: { mobile?: boolean; hideLogout?: boolean }) {
  const [open, setOpen] = useState(false)
  // ต้องอยู่นอก {open && (...)} ด้านล่าง — ปุ่ม "ใช้โค้ด" อยู่ใน dropdown ที่ unmount ทันทีที่ปิดเมนู
  // (setOpen(false) จาก onNavigate) ถ้า dialog state อยู่ในนั้นด้วยจะโดน unmount ก่อนทันโชว์ dialog
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false)
  const user = useUser()
  const { clearAuth } = useAuthStore()
  const router = useRouter()

  if (!user) return null

  async function handleLogout() {
    try {
      await api.post('/auth/logout')
    } catch (err: any) {
      // ไม่สนใจ error ตอน logout — ยังไง client state ก็ clear อยู่ดี
    } finally {
      clearAuth()
      toast.success('ออกจากระบบแล้ว')
      router.push('/')
    }
  }

  const initial = (user.display_name || user.u_name).charAt(0).toUpperCase()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="เมนูบัญชี"
        aria-expanded={open}
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-full transition-all hover:ring-2 hover:ring-primary/15',
          mobile && 'size-10 shrink-0 justify-center bg-card ring-1 ring-border hover:ring-primary/25',
        )}
      >
        {user.user_img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.user_img}
            alt={user.display_name}
            className={cn('rounded-full object-cover', mobile ? 'size-10' : 'size-8')}
          />
        ) : (
          <div className={cn('flex items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground', mobile ? 'size-10' : 'size-8')}>
            {initial}
          </div>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={cn(
            'readji-surface absolute right-0 z-20 w-56 overflow-hidden rounded-2xl shadow-[0_24px_54px_-28px_rgb(45_29_32_/_0.5)]',
            mobile ? 'top-full left-0 mt-3' : 'top-full right-0 mt-3',
          )}>
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-sm font-semibold text-foreground">
                {user.display_name || user.u_name}
              </p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>

            <nav className="py-1">
              <MenuLink href="/profile" onClick={() => setOpen(false)}>โปรไฟล์</MenuLink>
              <MenuLink href="/purchase-history" onClick={() => setOpen(false)}>ประวัติการซื้อ</MenuLink>
              <RedeemCodeMenuItem onNavigate={() => setOpen(false)} onOpenDialog={() => setRedeemDialogOpen(true)} />
              <MenuLink href="/writer/dashboard" onClick={() => setOpen(false)}>หน้านักเขียน</MenuLink>
              <MenuLink href="/referral" onClick={() => setOpen(false)}>ชวนเพื่อน</MenuLink>
              <MenuLink href="/contact-admin" onClick={() => setOpen(false)}>ติดต่อแอดมิน</MenuLink>

              {!hideLogout && (
                <>
                  <div className="my-1 border-t border-border" />
                  <button
                    onClick={handleLogout}
                    className="w-full cursor-pointer px-4 py-2 text-left text-sm text-destructive transition-colors hover:bg-accent"
                  >
                    ออกจากระบบ
                  </button>
                </>
              )}
            </nav>
          </div>
        </>
      )}

      <RedeemCodeDialog open={redeemDialogOpen} onOpenChange={setRedeemDialogOpen} />
    </div>
  )
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent"
    >
      {children}
    </Link>
  )
}

// ─── Navbar (main component) ───────────────────────────────────────────────────

export function Navbar() {
  const user = useUser()
  const isLoggedIn = useIsLoggedIn()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // ต้องอยู่นอก {mobileMenuOpen && (...)} ด้านล่าง — เหตุผลเดียวกับ UserMenu (ดูคอมเมนต์ที่นั่น)
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false)
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const router = useRouter()

  // จับ ?ref=CODE จาก URL ไว้ prefill ตอนเปิด RedeemCodeDialog ทีหลัง (ดู lib/referral-code.ts
  // สำหรับเหตุผลที่อ่าน window.location.search ตรงๆ แทน useSearchParams()) — Navbar mount ทุกหน้า
  // อยู่แล้ว เลยเป็นจุดที่เหมาะสุดที่จะดักจับครั้งเดียวตอนแอปโหลด ไม่ต้องเพิ่ม component ใหม่
  useEffect(() => {
    captureReferralCodeFromUrl()
  }, [])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen])

  async function handleMobileLogout() {
    try {
      await api.post('/auth/logout')
    } catch {
      // Clear the local session even if the server is already unavailable.
    } finally {
      clearAuth()
      setMobileMenuOpen(false)
      toast.success('ออกจากระบบแล้ว')
      router.push('/')
    }
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/78 shadow-[0_8px_28px_-24px_rgb(45_29_32_/_0.72)] backdrop-blur-xl">
        <div className="mx-auto flex h-[4.35rem] max-w-[1280px] items-center justify-between px-4 md:px-8">
          {/* Left: Logo + Nav pills */}
          <div className="flex min-w-0 items-center gap-5 md:gap-7">
            <Link href="/" className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80">
              {/* โลโก้จริงที่ user วาดมา (public/readji-wordmark.png — trim ขอบโปร่งใสออกแล้วจาก
                  ต้นฉบับ "Readji text 2 nobg.png" ด้วย sharp ของเดิม 1254×1254 มีขอบว่างเยอะ พอ
                  ตัดแล้วเหลือ 1185×321 ใส่ในกรอบเตี้ยๆ ของ navbar ได้พอดี) ใส่ gradient ด้วยเทคนิค
                  CSS mask — เอารูป PNG (ดำล้วน+โปร่งใส) มาเป็น mask แล้ววาด gradient จริงๆ ไว้ข้างใต้
                  ผ่าน mask ออกมาแค่ทรงตัวอักษร วิธีนี้ใช้กับรูป raster ได้ (bg-clip-text ใช้ได้แค่
                  กับตัวอักษรจริงเท่านั้น) สี 2 ตัวเหมือนรอบก่อน — --primary (น้ำตาลเข้ม) ไป --ring
                  (ชมพูฝุ่น) มีอยู่แล้วในธีมเว็บ ไม่ได้เดาสีใหม่ */}
              <span
                role="img"
                aria-label="Readji"
                className="aspect-[1185/321] h-9 -translate-y-1 bg-gradient-to-r from-[#54252b] to-[#b56871] [mask-image:url(/readji-wordmark.png)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-image:url(/readji-wordmark.png)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]"
              />
            </Link>
            <NavPills />
          </div>

          {/* Desktop actions */}
          <div className="hidden shrink-0 items-center gap-1 md:flex">
            <SearchLink />

            <Link
              href="/writer/dashboard"
              aria-label="โหมดนักเขียน"
              className="readji-icon-button"
            >
              <PenLine className="size-5" />
            </Link>

            <NotificationBell />

            <ContentPreferenceMenu />

            {/* ความกว้างคงที่เสมอ ไม่ว่าจะ login อยู่หรือไม่ — กัน search/ปากกา/แจ้งเตือน
                ขยับตำแหน่งตอน login/logout (ช่องนี้แคบ/กว้างไม่เท่ากันระหว่าง 2 สถานะ) */}
            <div className="ml-1 flex min-w-[150px] shrink-0 items-center justify-end">
              {isLoggedIn && user ? (
                <div className="flex items-center gap-2">
                  <CoinBadge point={user.point} />
                  <UserMenu />
                </div>
              ) : (
                <Link
                  href="/login"
                  className="rounded-full border border-primary/25 bg-card/70 px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-all hover:-translate-y-px hover:bg-primary hover:text-primary-foreground hover:shadow-md"
                >
                  เข้าสู่ระบบ
                </Link>
              )}
            </div>
          </div>

          {/* Mobile actions stay in the header for quick access; the drawer contains navigation only. */}
          <div className="flex shrink-0 items-center gap-0.5 md:hidden">
            <SearchLink />
            <NotificationBell />
            <ContentPreferenceMenu />
            {isLoggedIn && user && (
              <>
                <CoinBadge point={user.point} compact />
              </>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="เปิดเมนู"
              aria-expanded={mobileMenuOpen}
              className="readji-icon-button cursor-pointer"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="เมนูหลัก">
          <button
            type="button"
            aria-label="ปิดเมนู"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 cursor-default bg-foreground/35"
          />
          <aside className="absolute right-0 top-0 flex h-[100dvh] w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden border-l border-border bg-card shadow-[-18px_0_48px_-28px_rgb(45_29_32_/_0.62)]">
            <div className="flex h-[4.35rem] shrink-0 items-center justify-between border-b border-border px-5">
              <span
                role="img"
                aria-label="Readji"
                className="aspect-[1185/321] h-7 -translate-y-1 bg-gradient-to-r from-[#54252b] to-[#b56871] [mask-image:url(/readji-wordmark.png)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-image:url(/readji-wordmark.png)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]"
              />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="ปิดเมนู"
                className="readji-icon-button cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {isLoggedIn && user && (
              <div className="shrink-0 px-4 pt-4">
                <div className="flex items-center gap-3 rounded-2xl bg-muted/70 p-3">
                  {user.user_img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.user_img} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {(user.display_name || user.u_name).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{user.display_name || user.u_name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{user.u_name}</p>
                  </Link>
                </div>
              </div>
            )}

            <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-4">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                >
                  <Icon className="size-5 text-primary" />
                  {label}
                </Link>
              ))}
              <Link
                href="/search"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <Search className="size-5 text-primary" />
                ค้นหานิยาย
              </Link>
              {!isLoggedIn && (
                <Link
                  href="/writer/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <PenLine className="size-5" />
                  <span className="flex-1">Writer Studio</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium">ใช้บนคอม</span>
                </Link>
              )}

              {isLoggedIn && user && (
                <>
                  <div className="my-2 border-t border-border" />
                  <Link
                    href="/topup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                  >
                    <Coins className="size-5 text-amber-600" />
                    <span className="flex-1">เติมเหรียญ</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-amber-700 shadow-sm">{user.point.toLocaleString()}</span>
                  </Link>
                  <p className="mt-4 px-3 text-[11px] font-bold tracking-[0.14em] text-muted-foreground">บัญชี</p>
                  {ACCOUNT_NAV_ITEMS_BEFORE_REDEEM.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Icon className="size-5" />
                      <span className="flex-1">{label}</span>
                    </Link>
                  ))}
                  <RedeemCodeMenuItem mobile onNavigate={() => setMobileMenuOpen(false)} onOpenDialog={() => setRedeemDialogOpen(true)} />
                  {ACCOUNT_NAV_ITEMS_AFTER_REDEEM.map(({ href, label, icon: Icon, desktopOnly }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Icon className="size-5" />
                      <span className="flex-1">{label}</span>
                      {desktopOnly && <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium">ใช้บนคอม</span>}
                    </Link>
                  ))}
                </>
              )}
            </nav>

            <div className="shrink-0 border-t border-border p-4">
              {isLoggedIn && user ? (
                <button
                  type="button"
                  onClick={handleMobileLogout}
                  className="flex w-full cursor-pointer items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
                >
                  ออกจากระบบ
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <LogIn className="size-4" />
                  เข้าสู่ระบบ
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}

      <RedeemCodeDialog open={redeemDialogOpen} onOpenChange={setRedeemDialogOpen} />
    </>
  )
}
