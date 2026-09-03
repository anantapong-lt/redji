'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, History, Home, LogIn, Menu, PenLine, Rss, Search, X } from 'lucide-react'

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
    <nav className="hidden items-center gap-1.5 text-sm font-medium md:flex">
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

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/78 shadow-[0_8px_28px_-24px_rgb(45_29_32_/_0.72)] backdrop-blur-xl">
        <div className="mx-auto flex h-[4.35rem] max-w-[1280px] items-center justify-between px-4 md:px-8">
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
            <DisabledIconButton label="โหมดนักเขียน"><PenLine className="size-5" /></DisabledIconButton>
            <DisabledIconButton label="การแจ้งเตือน"><Bell className="size-5" /></DisabledIconButton>
            <div className="ml-1 flex min-w-[150px] shrink-0 items-center justify-end">
              <Link
                href="/login"
                className="rounded-full border border-primary/25 bg-card/70 px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-all hover:-translate-y-px hover:bg-primary hover:text-primary-foreground hover:shadow-md"
              >
                เข้าสู่ระบบ
              </Link>
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
                { label: 'Writer Studio', icon: PenLine },
              ].map(({ label, icon: Icon }) => (
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
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
