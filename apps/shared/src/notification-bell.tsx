'use client'

import { useEffect, useState } from 'react'
import { Bell, Banknote, CheckCircle2, CircleX, LoaderCircle } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'

export type NotificationType =
  | 'withdrawal_requested'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'writer_application_approved'
  | 'writer_application_rejected'

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message: string
  target_url: string | null
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export function getNotificationIcon(type: NotificationType) {
  if (type === 'withdrawal_requested') return Banknote
  if (type === 'withdrawal_approved' || type === 'writer_application_approved') return CheckCircle2
  if (type === 'withdrawal_rejected' || type === 'writer_application_rejected') return CircleX
  return Bell
}

export function getNotificationIconClass(type: NotificationType) {
  if (type === 'withdrawal_requested') return 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
  if (type === 'withdrawal_approved' || type === 'writer_application_approved') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
  if (type === 'withdrawal_rejected' || type === 'writer_application_rejected') return 'bg-destructive/10 text-destructive'
  return 'bg-primary/10 text-primary'
}

export function NotificationBell({
  apiUrl,
  accessToken,
  unreadCount,
  onUnreadCountChange,
  onNotificationClick,
  triggerClassName = 'readji-icon-button relative',
  side = 'bottom',
  align = 'end',
}: {
  apiUrl: string
  accessToken: string | null
  unreadCount?: number
  onUnreadCountChange?: (count: number) => void
  onNotificationClick?: (notification: NotificationItem) => void
  triggerClassName?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [internalUnreadCount, setInternalUnreadCount] = useState(0)
  const resolvedUnreadCount = unreadCount ?? internalUnreadCount
  const updateUnreadCount = (count: number) => {
    setInternalUnreadCount(count)
    onUnreadCountChange?.(count)
  }

  useEffect(() => {
    if (!accessToken) {
      updateUnreadCount(0)
      return
    }
    let active = true
    const loadUnreadCount = async () => {
      try {
        const response = await fetch(`${apiUrl}/notifications/unread-count`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        })
        if (!response.ok) return
        const result = await response.json() as { count: number }
        if (active) updateUnreadCount(result.count)
      } catch {
        if (active) updateUnreadCount(0)
      }
    }
    void loadUnreadCount()
    const interval = window.setInterval(() => void loadUnreadCount(), 60_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [accessToken, apiUrl])

  useEffect(() => {
    if (!open || !accessToken) return
    let active = true
    setIsLoading(true)
    void fetch(`${apiUrl}/notifications?page=${page}&limit=5`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load notifications')
        return response.json() as Promise<{ notifications: NotificationItem[]; pagination: { total_pages: number } }>
      })
      .then((result) => {
        if (!active) return
        setNotifications((current) => page === 1 ? result.notifications : [...current, ...result.notifications])
        setTotalPages(result.pagination.total_pages)
      })
      .catch(() => { if (active) setNotifications([]) })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [accessToken, apiUrl, open, page])

  async function openNotification(notification: NotificationItem) {
    let selectedNotification = notification
    if (accessToken && !notification.read_at) {
      try {
        const response = await fetch(`${apiUrl}/notifications/${notification.id}/read`, {
          method: 'PATCH',
          headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        })
        if (response.ok) {
          const result = await response.json() as { notification: NotificationItem }
          selectedNotification = result.notification
          setNotifications((current) => current.map((item) => item.id === notification.id ? result.notification : item))
          updateUnreadCount(Math.max(0, resolvedUnreadCount - 1))
        }
      } catch {
        // The notification can still be opened if marking it as read fails.
      }
    }
    setOpen(false)
    onNotificationClick?.(selectedNotification)
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen)
      if (nextOpen) setPage(1)
    }}>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" aria-label={resolvedUnreadCount > 0 ? `การแจ้งเตือนใหม่ ${resolvedUnreadCount} รายการ` : 'การแจ้งเตือน'} title="การแจ้งเตือน" className={triggerClassName}>
          <Bell className="size-5" />
          {resolvedUnreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-white">{resolvedUnreadCount > 99 ? '99+' : resolvedUnreadCount}</span>}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content side={side} align={align} sideOffset={8} className="z-[70] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border/70 bg-popover p-0 text-popover-foreground shadow-lg outline-hidden">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <div><p className="font-semibold">การแจ้งเตือน</p><p className="text-xs text-muted-foreground">รายการล่าสุดสำหรับคุณ</p></div>
            {resolvedUnreadCount > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">ใหม่ {resolvedUnreadCount}</span>}
          </div>
          {isLoading && page === 1 ? <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />กำลังโหลด...</div> : notifications.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">ยังไม่มีการแจ้งเตือน</p> : <div className="max-h-80 overflow-y-auto p-2">{notifications.map((notification) => {
            const Icon = getNotificationIcon(notification.type)
            return <button key={notification.id} type="button" onClick={() => void openNotification(notification)} className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent ${notification.read_at ? '' : 'bg-primary/5'}`}>
              <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${getNotificationIconClass(notification.type)}`}><Icon className="size-4" /></span>
              <span className="min-w-0 flex-1"><span className="flex items-start gap-2"><span className="flex-1 truncate font-medium">{notification.title}</span>{!notification.read_at && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-label="ยังไม่ได้อ่าน" />}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{notification.message}</span><span className="mt-1.5 block text-[11px] text-muted-foreground">{new Date(notification.created_at).toLocaleString('th-TH')}</span></span>
            </button>
          })}{page < totalPages && <button type="button" disabled={isLoading} onClick={() => setPage((current) => current + 1)} className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60">{isLoading && <LoaderCircle className="size-4 animate-spin" />}แสดงเพิ่มเติม</button>}</div>}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
