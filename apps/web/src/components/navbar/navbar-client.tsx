'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, History, Home, LogIn, LogOut, Menu, PenLine, Rss, Search, X } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { userRole, type AuthUser } from '@/interface/user.interface'

const NAV_ITEMS = [
  { label: 'หน้าแรก', icon: Home, href: '/' },
  { label: 'ฟีด', icon: Rss },
  { label: 'ประวัติ', icon: History },
]

function DisabledIconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled
      aria-label={`${label} (ยังไม่เปิดใช้งาน)`}
      title="ยังไม่เปิดใช้งาน"
      className="readji-icon-button cursor-not-allowed opacity-45"
    >
      {children}
    </button>
  )
}

function DesktopNav() {
  const pathname = usePathname()

  return (
    <nav className="hidden items-center gap-1.5 text-sm font-medium xl:flex">
      {NAV_ITEMS.map(({ label, icon: Icon, href }) =>
        href ? (
          <Link
            key={label}
            href={href}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all duration-200 ${
              pathname === href ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ) : (
          <span
            key={label}
            aria-disabled="true"
            title="ยังไม่เปิดใช้งาน"
            className="flex cursor-not-allowed items-center gap-1.5 rounded-full px-3 py-1.5 text-muted-foreground opacity-45"
          >
            <Icon className="size-4" />
            {label}
          </span>
        ),
      )}
    </nav>
  )
}

export function NavbarClient({ initialUser }: { initialUser: AuthUser | null }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { logout, status, user: clientUser } = useAuth()
  const user = status === 'loading' ? initialUser : clientUser

  async function handleLogout() {
    await logout()
    setMobileMenuOpen(false)
  }

  const userInitial = user?.display_name.trim().charAt(0)
    || user?.username.trim().charAt(0)
    || '?'

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/78 shadow-[0_8px_28px_-24px_rgb(45_29_32_/_0.72)] backdrop-blur-xl">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-8">
          <div className="flex h-[4.35rem] items-center justify-between">
          <div className="flex min-w-0 items-center gap-5 md:gap-7">
            <Link href="/" className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80">
              <span
                role="img"
                aria-label="Readji"
                className="aspect-[1185/321] h-9 -translate-y-1 bg-gradient-to-r from-[#54252b] to-[#b56871] [mask-image:url(/readji-wordmark.png)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-image:url(/readji-wordmark.png)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]"
              />
            </Link>
            <DesktopNav />
          </div>

          <div className="hidden shrink-0 items-center gap-1 md:flex">
            <DisabledIconButton label="ค้นหา"><Search className="size-5" /></DisabledIconButton>
            {user?.role === userRole.WRITER ? (
              <Link
                href="/writer"
                aria-label="โหมดนักเขียน"
                title="โหมดนักเขียน"
                className="readji-icon-button"
              >
                <PenLine className="size-5" />
              </Link>
            ) : (
              <DisabledIconButton label="โหมดนักเขียน"><PenLine className="size-5" /></DisabledIconButton>
            )}
            <DisabledIconButton label="การแจ้งเตือน"><Bell className="size-5" /></DisabledIconButton>
            <div className="ml-1 flex min-w-[150px] shrink-0 items-center justify-end gap-2">
              {status === 'loading' && !user ? (
                <div className="h-10 w-32 animate-pulse rounded-full bg-muted" aria-label="กำลังตรวจสอบสถานะผู้ใช้" />
              ) : user ? (
                <>
                  <div className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-card/70 py-1.5 pr-3 pl-1.5">
                    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="size-full object-cover" />
                      ) : userInitial}
                    </span>
                    <span className="max-w-32 truncate text-sm font-semibold text-foreground">
                      {user.display_name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    aria-label="ออกจากระบบ"
                    title="ออกจากระบบ"
                    className="readji-icon-button cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="size-5" />
                  </button>
                </>
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

          <div className="flex shrink-0 items-center gap-0.5 md:hidden">
            <DisabledIconButton label="ค้นหา"><Search className="size-5" /></DisabledIconButton>
            <DisabledIconButton label="การแจ้งเตือน"><Bell className="size-5" /></DisabledIconButton>
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
          <aside className="absolute top-0 right-0 flex h-[100dvh] w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden border-l border-border bg-card shadow-[-18px_0_48px_-28px_rgb(45_29_32_/_0.62)]">
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

            <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-4">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <Home className="size-5 text-primary" />
                หน้าแรก
              </Link>
              {[
                { label: 'ฟีด', icon: Rss },
                { label: 'ประวัติ', icon: History },
                { label: 'ค้นหานิยาย', icon: Search },
                { label: 'Writer Studio', icon: PenLine, href: user?.role === userRole.WRITER ? '/writer' : undefined },
              ].map(({ label, icon: Icon, href }) => href ? (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                >
                  <Icon className="size-5 text-primary" />
                  {label}
                </Link>
              ) : (
                <span
                  key={label}
                  aria-disabled="true"
                  title="ยังไม่เปิดใช้งาน"
                  className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground opacity-45"
                >
                  <Icon className="size-5" />
                  {label}
                </span>
              ))}
            </nav>

            <div className="shrink-0 space-y-2 border-t border-border p-4">
              {status === 'loading' && !user ? (
                <div className="h-12 w-full animate-pulse rounded-xl bg-muted" aria-label="กำลังตรวจสอบสถานะผู้ใช้" />
              ) : user ? (
                <>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="size-full object-cover" />
                      ) : userInitial}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{user.display_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-accent"
                  >
                    <LogOut className="size-4" />
                    ออกจากระบบ
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <LogIn className="size-4" />
                    เข้าสู่ระบบ
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex w-full items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-accent"
                  >
                    สมัครสมาชิก
                  </Link>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
