'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, CheckCircle2, ChevronDown, CircleX, Home, LogIn, LogOut, Menu, PenLine, Search, UserRound, X } from 'lucide-react'
import { GiTwoCoins } from 'react-icons/gi'
import { useAuth } from '@/components/auth/auth-provider'
import { getNotifications, getUnreadNotificationCount, markNotificationRead } from '@/controllers/notification.controller'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { userRole, type AuthUser } from '@/interface/user.interface'
import { SITE_CONFIG } from '@/site.config'
import { WriterApplicationDialog } from './writer-application-dialog'
import type { UserNotification } from '@/interface/notification.interface'
import { NOTIFICATION_TYPE } from '@/constants/notification.constant'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const NAV_ITEMS = [
  { label: 'หน้าแรก', icon: Home, href: '/' },
  { label: 'เติมเงิน', icon: GiTwoCoins, href: '/topup' },
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

function formatBalance(balance: string) {
  return Number(balance).toLocaleString('th-TH')
}

function getNotificationIcon(type: UserNotification['type']) {
  return type === NOTIFICATION_TYPE.WRITER_APPLICATION_APPROVED ? CheckCircle2 : type === NOTIFICATION_TYPE.WRITER_APPLICATION_REJECTED ? CircleX : Bell
}

function getNotificationIconClass(type: UserNotification['type']) {
  return type === NOTIFICATION_TYPE.WRITER_APPLICATION_APPROVED
    ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
    : type === NOTIFICATION_TYPE.WRITER_APPLICATION_REJECTED
      ? 'bg-destructive/10 text-destructive'
      : 'bg-primary/10 text-primary'
}

function NotificationPopover({
  accessToken,
  unreadCount,
  onUnreadCountChange,
}: {
  accessToken: string | null
  unreadCount: number
  onUnreadCountChange: (count: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<UserNotification | null>(null)

  useEffect(() => {
    if (!open || !accessToken) return
    setIsLoading(true)
    void getNotifications(1, 5, accessToken)
      .then(({ notifications: nextNotifications }) => setNotifications(nextNotifications))
      .catch(() => setNotifications([]))
      .finally(() => setIsLoading(false))
  }, [accessToken, open])

  async function handleNotificationClick(notification: UserNotification) {
    if (accessToken && !notification.read_at) {
      try {
        const result = await markNotificationRead(notification.id, accessToken)
        setNotifications((current) => current.map((item) => item.id === notification.id ? result.notification : item))
        onUnreadCountChange(Math.max(0, unreadCount - 1))
        notification = result.notification
      } catch {
        // The notification can still be viewed if marking it as read fails.
      }
    }
    setOpen(false)
    setSelectedNotification(notification)
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={unreadCount > 0 ? `การแจ้งเตือนใหม่ ${unreadCount} รายการ` : 'การแจ้งเตือน'} title="การแจ้งเตือน" className="readji-icon-button relative">
            <Bell className="size-5" />
            {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border-border/70 p-0 shadow-[0_18px_45px_-24px_rgb(45_29_32_/_0.7)]">
          <div className="flex items-center justify-between border-b border-border/70 bg-gradient-to-r from-primary/10 via-background to-background px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Bell className="size-4" />
              </span>
              <div>
                <p className="font-semibold leading-5">การแจ้งเตือน</p>
                <p className="text-[11px] text-muted-foreground">อัปเดตล่าสุดของคุณ</p>
              </div>
            </div>
            {unreadCount > 0 && <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-white">ใหม่ {unreadCount}</span>}
          </div>
          {isLoading ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
          ) : notifications.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">ยังไม่มีการแจ้งเตือน</p>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto p-2">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void handleNotificationClick(notification)}
                  className={`group flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-all hover:-translate-y-px hover:border-primary/20 hover:bg-accent/70 hover:shadow-sm ${notification.read_at ? 'border-transparent' : 'border-primary/15 bg-primary/[0.04]'}`}
                >
                  {(() => { const Icon = getNotificationIcon(notification.type); return <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${getNotificationIconClass(notification.type)}`}><Icon className="size-4" /></span> })()}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span className="block flex-1 truncate text-sm font-semibold">{notification.title}</span>
                      {!notification.read_at && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-label="ยังไม่ได้อ่าน" />}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted-foreground">{notification.message}</span>
                    <span className="mt-1.5 block text-[11px] text-muted-foreground/80">{new Date(notification.created_at).toLocaleString('th-TH')}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Dialog open={selectedNotification !== null} onOpenChange={(dialogOpen) => { if (!dialogOpen) setSelectedNotification(null) }}>
        <DialogContent className="overflow-hidden rounded-2xl p-0 sm:max-w-md">
          <div className="bg-gradient-to-br from-primary/15 via-background to-background px-6 pb-5 pt-6">
            <DialogHeader className="gap-3">
              {selectedNotification && (() => { const Icon = getNotificationIcon(selectedNotification.type); return <span className={`flex size-11 items-center justify-center rounded-xl ${getNotificationIconClass(selectedNotification.type)}`}><Icon className="size-5" /></span> })()}
              <div>
                <DialogTitle className="pr-8 text-lg leading-7">{selectedNotification?.title}</DialogTitle>
                <p className="mt-1 text-xs text-muted-foreground">{selectedNotification && new Date(selectedNotification.created_at).toLocaleString('th-TH')}</p>
              </div>
            </DialogHeader>
          </div>
          <DialogDescription className="whitespace-pre-line px-6 py-5 text-sm leading-7 text-foreground/80">
            {selectedNotification?.message}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function NavbarClient({
  initialUser,
  initialUnreadNotificationCount,
}: {
  initialUser: AuthUser | null
  initialUnreadNotificationCount: number
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [readerNavbarVisible, setReaderNavbarVisible] = useState(true)
  const [writerApplicationOpen, setWriterApplicationOpen] = useState(false)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(initialUnreadNotificationCount)
  const pathname = usePathname()
  const { accessToken, logout, status, user: clientUser } = useAuth()
  const user = status === 'loading' ? initialUser : clientUser
  const isReaderPage = /^\/content\/[^/]+\/[^/]+$/.test(pathname)

  useEffect(() => {
    if (!isReaderPage) {
      setReaderNavbarVisible(true)
      return
    }

    let previousScrollY = window.scrollY
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (currentScrollY <= 0) setReaderNavbarVisible(true)
      else if (currentScrollY > previousScrollY + 8) setReaderNavbarVisible(false)
      previousScrollY = currentScrollY
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isReaderPage])

  useEffect(() => {
    if (!accessToken) {
      if (status !== 'loading') setUnreadNotificationCount(0)
      return
    }
    let active = true
    void getUnreadNotificationCount(accessToken)
      .then(({ count }) => { if (active) setUnreadNotificationCount(count) })
      .catch(() => { if (active) setUnreadNotificationCount(0) })
    return () => { active = false }
  }, [accessToken, pathname])

  async function handleLogout() {
    await logout()
    setMobileMenuOpen(false)
  }

  const userInitial = user?.display_name.trim().charAt(0)
    || user?.username.trim().charAt(0)
    || '?'

  return (
    <>
      <header className={`sticky top-0 z-50 border-b border-border/70 bg-background/78 shadow-[0_8px_28px_-24px_rgb(45_29_32_/_0.72)] backdrop-blur-xl transition-transform duration-200 ${
        isReaderPage && !readerNavbarVisible ? '-translate-y-full' : 'translate-y-0'
      }`}>
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
            ) : user?.role === userRole.USER ? (
              <button
                type="button"
                onClick={() => setWriterApplicationOpen(true)}
                aria-label="สมัครนักเขียน"
                title="สมัครนักเขียน"
                className="readji-icon-button cursor-pointer"
              >
                <PenLine className="size-5" />
              </button>
            ) : (
              <DisabledIconButton label="โหมดนักเขียน"><PenLine className="size-5" /></DisabledIconButton>
            )}
            {user ? (
              <NotificationPopover
                accessToken={accessToken}
                unreadCount={unreadNotificationCount}
                onUnreadCountChange={setUnreadNotificationCount}
              />
            ) : <DisabledIconButton label="การแจ้งเตือน"><Bell className="size-5" /></DisabledIconButton>}
            <div className="ml-1 flex min-w-[150px] shrink-0 items-center justify-end gap-2">
              {status === 'loading' && !user ? (
                <div className="h-10 w-32 animate-pulse rounded-full bg-muted" aria-label="กำลังตรวจสอบสถานะผู้ใช้" />
              ) : user ? (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 min-w-0 gap-2 rounded-full bg-card/70 py-1.5 pr-2.5 pl-1.5 shadow-none"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="size-full object-cover" />
                        ) : userInitial}
                      </span>
                      <span className="max-w-32 truncate font-semibold text-foreground">
                        {user.display_name}
                      </span>
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-aria-expanded/button:rotate-180" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" sideOffset={8} className="w-72 p-2">
                    <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal">
                      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="size-full object-cover" />
                        ) : userInitial}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-foreground">{user.display_name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                      </span>
                    </DropdownMenuLabel>

                    <div className="mx-1 mb-2 flex items-center justify-between gap-3 rounded-lg bg-accent/60 px-3 py-2.5">
                      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <GiTwoCoins className="size-4 text-amber-500" />
                        ยอด{SITE_CONFIG.coinName}คงเหลือ
                      </span>
                      <span className="text-sm font-bold tabular-nums text-primary">
                        {formatBalance(user.balance)} {SITE_CONFIG.coinName}
                      </span>
                    </div>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled className="py-2.5">
                      <UserRound />
                      โปรไฟล์
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer py-2.5">
                      <Link href="/topup">
                        <GiTwoCoins className="size-4 text-amber-500" />
                        เติม{SITE_CONFIG.coinName}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled className="py-2.5">
                      <History />
                      ประวัติการทำรายการ
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => void handleLogout()}
                      className="cursor-pointer py-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                      <LogOut />
                      ออกจากระบบ
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
            {user ? (
              <NotificationPopover
                accessToken={accessToken}
                unreadCount={unreadNotificationCount}
                onUnreadCountChange={setUnreadNotificationCount}
              />
            ) : <DisabledIconButton label="การแจ้งเตือน"><Bell className="size-5" /></DisabledIconButton>}
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
                { label: 'เติมเงิน', icon: GiTwoCoins, href: '/topup' },
                { label: 'ค้นหานิยาย', icon: Search },
                { label: user?.role === userRole.WRITER ? 'Writer Studio' : 'สมัครนักเขียน', icon: PenLine, href: user?.role === userRole.WRITER ? '/writer' : undefined, canApply: user?.role === userRole.USER },
              ].map(({ label, icon: Icon, href, canApply }) => canApply ? (
                <button
                  key={label}
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); setWriterApplicationOpen(true) }}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                >
                  <Icon className="size-5 text-primary" />
                  {label}
                </button>
              ) : href ? (
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

      <WriterApplicationDialog open={writerApplicationOpen} onOpenChange={setWriterApplicationOpen} />
    </>
  )
}
