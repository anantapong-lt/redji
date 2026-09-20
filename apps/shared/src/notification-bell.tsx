'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Bell, Banknote, CheckCircle2, CircleX, LoaderCircle, X } from 'lucide-react'
import { Dialog as DialogPrimitive, Popover as PopoverPrimitive } from 'radix-ui'

type PopoverMeasurable = NonNullable<
  NonNullable<ComponentProps<typeof PopoverPrimitive.Anchor>['virtualRef']>['current']
>

export type NotificationType =
  | 'withdrawal_requested'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'writer_application_approved'
  | 'writer_application_rejected'
  | 'content_hidden'

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
  if (type === 'withdrawal_rejected' || type === 'writer_application_rejected' || type === 'content_hidden')
    return CircleX
  return Bell
}

export function getNotificationIconClass(type: NotificationType) {
  if (type === 'withdrawal_requested') return 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
  if (type === 'withdrawal_approved' || type === 'writer_application_approved')
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
  if (type === 'withdrawal_rejected' || type === 'writer_application_rejected' || type === 'content_hidden')
    return 'bg-destructive/10 text-destructive'
  return 'bg-primary/10 text-primary'
}

export function NotificationDetailDialog({
  notification,
  onOpenChange,
  layerClassName = 'z-[50]',
}: {
  notification: NotificationItem | null
  onOpenChange: (open: boolean) => void
  layerClassName?: string
}) {
  const Icon = notification ? getNotificationIcon(notification.type) : Bell

  return (
    <DialogPrimitive.Root open={notification !== null} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={`fixed inset-0 isolate ${layerClassName} bg-black/10 backdrop-blur-xs duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0`}
        />
        <DialogPrimitive.Content
          className={`fixed top-1/2 left-1/2 ${layerClassName} grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-0 overflow-hidden rounded-xl border border-border/80 bg-popover p-0 text-sm text-popover-foreground shadow-xl outline-none sm:max-w-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95`}
        >
          <div className="border-b border-border bg-muted/30 px-5 py-4">
            <div className="flex items-start gap-3 pr-7">
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${notification ? getNotificationIconClass(notification.type) : ''}`}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="text-base leading-6 font-semibold">
                  {notification?.title}
                </DialogPrimitive.Title>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {notification && new Date(notification.created_at).toLocaleString('th-TH')}
                </p>
              </div>
            </div>
          </div>
          <DialogPrimitive.Description className="whitespace-pre-line px-5 py-4 text-sm leading-[1.625rem] text-foreground/85">
            {notification?.message}
          </DialogPrimitive.Description>
          <DialogPrimitive.Close
            aria-label="ปิด"
            className="absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function NotificationBell({
  apiUrl,
  accessToken,
  unreadCount,
  onUnreadCountChange,
  onNotificationClick,
  triggerClassName = 'readji-icon-button relative',
  popoverClassName = '',
  anchorElement,
  portalContainer,
  side = 'bottom',
  align = 'end',
  sideOffset = 8,
  presentation = 'popover',
}: {
  apiUrl: string
  accessToken: string | null
  unreadCount?: number
  onUnreadCountChange?: (count: number) => void
  onNotificationClick?: (notification: NotificationItem) => void
  triggerClassName?: string
  popoverClassName?: string
  anchorElement?: PopoverMeasurable | null
  portalContainer?: HTMLElement | null
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  presentation?: 'popover' | 'bottom-sheet'
}) {
  // A sidebar can anchor to its full footer rather than the bell inside it.
  const virtualAnchor = useMemo(() => (anchorElement ? { current: anchorElement } : undefined), [anchorElement])
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [internalUnreadCount, setInternalUnreadCount] = useState(0)
  const [sheetDragOffset, setSheetDragOffset] = useState(0)
  const [isDraggingSheet, setIsDraggingSheet] = useState(false)
  const sheetDragStartYRef = useRef(0)
  const sheetDragOffsetRef = useRef(0)
  const sheetDragPointerIdRef = useRef<number | null>(null)
  const resolvedUnreadCount = unreadCount ?? internalUnreadCount
  const updateUnreadCount = (count: number) => {
    setInternalUnreadCount(count)
    onUnreadCountChange?.(count)
  }

  useEffect(() => {
    // A parent that owns unreadCount (such as the Web navbar) is the sole
    // source of this request. This prevents duplicate desktop/mobile bells
    // from each fetching the same value.
    if (unreadCount !== undefined) return
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
        const result = (await response.json()) as { count: number }
        if (active) updateUnreadCount(result.count)
      } catch {
        if (active) updateUnreadCount(0)
      }
    }
    void loadUnreadCount()
    const interval = setInterval(() => void loadUnreadCount(), 60_000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [accessToken, apiUrl, unreadCount])

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
        setNotifications((current) => (page === 1 ? result.notifications : [...current, ...result.notifications]))
        setTotalPages(result.pagination.total_pages)
      })
      .catch(() => {
        if (active) setNotifications([])
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
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
          const result = (await response.json()) as { notification: NotificationItem }
          selectedNotification = result.notification
          setNotifications((current) =>
            current.map((item) => (item.id === notification.id ? result.notification : item)),
          )
          updateUnreadCount(Math.max(0, resolvedUnreadCount - 1))
        }
      } catch {
        // The notification can still be opened if marking it as read fails.
      }
    }
    setOpen(false)
    onNotificationClick?.(selectedNotification)
  }

  async function markAllRead() {
    if (!accessToken || resolvedUnreadCount === 0 || isMarkingAllRead) return
    setIsMarkingAllRead(true)
    try {
      const response = await fetch(`${apiUrl}/notifications/read-all`, {
        method: 'PATCH',
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Unable to mark all notifications as read')
      const readAt = new Date().toISOString()
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, read_at: notification.read_at ?? readAt })),
      )
      updateUnreadCount(0)
    } catch {
      // The list remains usable if the bulk update fails.
    } finally {
      setIsMarkingAllRead(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) setPage(1)
    if (!nextOpen) {
      sheetDragOffsetRef.current = 0
      setSheetDragOffset(0)
      setIsDraggingSheet(false)
    }
  }

  function startSheetDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    sheetDragStartYRef.current = event.clientY
    sheetDragOffsetRef.current = 0
    sheetDragPointerIdRef.current = event.pointerId
    const dragHandle = event.currentTarget as HTMLDivElement & {
      setPointerCapture?: (pointerId: number) => void
    }
    dragHandle.setPointerCapture?.(event.pointerId)
    setIsDraggingSheet(true)
  }

  function moveSheetDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isDraggingSheet || sheetDragPointerIdRef.current !== event.pointerId) return
    const offset = Math.max(0, event.clientY - sheetDragStartYRef.current)
    sheetDragOffsetRef.current = offset
    setSheetDragOffset(offset)
  }

  function finishSheetDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (sheetDragPointerIdRef.current !== event.pointerId) return
    const dragHandle = event.currentTarget as HTMLDivElement & {
      hasPointerCapture?: (pointerId: number) => boolean
      releasePointerCapture?: (pointerId: number) => void
    }
    if (dragHandle.hasPointerCapture?.(event.pointerId)) {
      dragHandle.releasePointerCapture?.(event.pointerId)
    }
    sheetDragPointerIdRef.current = null
    setIsDraggingSheet(false)

    if (sheetDragOffsetRef.current >= 72) {
      sheetDragOffsetRef.current = 10_000
      setSheetDragOffset(10_000)
      setTimeout(() => handleOpenChange(false), 180)
      return
    }

    sheetDragOffsetRef.current = 0
    setSheetDragOffset(0)
  }

  const trigger = (
    <button
      type="button"
      aria-label={resolvedUnreadCount > 0 ? `การแจ้งเตือนใหม่ ${resolvedUnreadCount} รายการ` : 'การแจ้งเตือน'}
      title="การแจ้งเตือน"
      className={triggerClassName}
    >
      <Bell className="size-5" />
      {resolvedUnreadCount > 0 && (
        <span className="absolute right-0 top-0 z-10 flex min-w-4 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-white">
          {resolvedUnreadCount > 99 ? '99+' : resolvedUnreadCount}
        </span>
      )}
    </button>
  )

  const panelContent = (
    <>
      <div
        className={`flex shrink-0 items-center justify-between gap-2 border-b border-border/70 ${presentation === 'bottom-sheet' ? 'px-5 py-3' : 'px-3 py-2.5'}`}
      >
        <div>
          <p className="text-sm font-semibold">การแจ้งเตือน</p>
          <p className="text-[11px] text-muted-foreground">รายการล่าสุดสำหรับคุณ</p>
        </div>
        {resolvedUnreadCount > 0 && (
          <button
            type="button"
            disabled={isMarkingAllRead}
            onClick={() => void markAllRead()}
            className="rounded-md px-1.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isMarkingAllRead ? 'กำลังอัปเดต...' : 'อ่านทั้งหมด'}
          </button>
        )}
      </div>
      {isLoading && page === 1 ? (
        <div className={`flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground ${presentation === 'bottom-sheet' ? 'flex-1' : ''}`}>
          <LoaderCircle className="size-4 animate-spin" />
          กำลังโหลด...
        </div>
      ) : notifications.length === 0 ? (
        <p className={`px-3 py-8 text-center text-sm text-muted-foreground ${presentation === 'bottom-sheet' ? 'flex flex-1 items-center justify-center' : ''}`}>ยังไม่มีการแจ้งเตือน</p>
      ) : (
        <div
          className={`min-h-0 overflow-y-auto p-1.5 ${presentation === 'bottom-sheet' ? 'max-h-[min(68dvh,32rem)] flex-1 px-3 pb-[max(0.375rem,env(safe-area-inset-bottom))]' : 'max-h-72'}`}
        >
          {notifications.map((notification) => {
            const Icon = getNotificationIcon(notification.type)
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => void openNotification(notification)}
                className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-accent ${notification.read_at ? '' : 'bg-primary/5'}`}
              >
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md ${getNotificationIconClass(notification.type)}`}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start gap-1.5">
                    <span className="flex-1 truncate text-sm font-medium">{notification.title}</span>
                    {!notification.read_at && (
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-label="ยังไม่ได้อ่าน" />
                    )}
                  </span>
                  <span className="mt-0.5 block line-clamp-2 text-xs leading-[1.125rem] text-muted-foreground">
                    {notification.message}
                  </span>
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {new Date(notification.created_at).toLocaleString('th-TH')}
                  </span>
                </span>
              </button>
            )
          })}
          {page < totalPages && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setPage((current) => current + 1)}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading && <LoaderCircle className="size-4 animate-spin" />}แสดงเพิ่มเติม
            </button>
          )}
        </div>
      )}
    </>
  )

  if (presentation === 'bottom-sheet') {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
        <DialogPrimitive.Portal container={portalContainer}>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <DialogPrimitive.Content
            style={{
              minHeight: '60dvh',
              maxHeight: '85dvh',
              zIndex: 71,
              ...(sheetDragOffset > 0 ? { transform: `translateY(${sheetDragOffset}px)` } : {}),
            }}
            className={`fixed inset-x-0 bottom-0 z-[71] flex min-h-[60dvh] max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl border border-b-0 border-border/70 bg-popover text-popover-foreground shadow-2xl outline-none duration-200 data-open:animate-in data-open:slide-in-from-bottom-full data-closed:animate-out data-closed:slide-out-to-bottom-full ${isDraggingSheet ? 'transition-none' : 'transition-transform'}`}
          >
            <DialogPrimitive.Title className="sr-only">การแจ้งเตือน</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              รายการแจ้งเตือนล่าสุดสำหรับคุณ
            </DialogPrimitive.Description>
            <div
              className="flex h-7 shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing"
              role="button"
              tabIndex={0}
              aria-label="ลากลงเพื่อปิด"
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') handleOpenChange(false)
              }}
              onPointerDown={startSheetDrag}
              onPointerMove={moveSheetDrag}
              onPointerUp={finishSheetDrag}
              onPointerCancel={finishSheetDrag}
            >
              <span className="h-1 w-10 rounded-full bg-muted-foreground/25" />
            </div>
            {panelContent}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    )
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      {virtualAnchor && <PopoverPrimitive.Anchor virtualRef={virtualAnchor} />}
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={portalContainer}>
        <PopoverPrimitive.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={16}
          style={{
            width: 'min(20rem, calc(100vw - 2rem))',
            maxHeight: 'min(calc(100dvh - 2rem), var(--radix-popover-content-available-height))',
            zIndex: 70,
          }}
          className={`z-[70] flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-border/70 bg-popover p-0 text-popover-foreground shadow-md outline-hidden ${popoverClassName}`}
        >
          {panelContent}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
