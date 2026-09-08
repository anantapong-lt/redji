'use client'

import { useEffect, useState } from 'react'
import { Bell, CheckCircle2, CircleX, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NOTIFICATION_TYPE } from '@/constants/notification.constant'
import { getNotifications, markNotificationRead } from '@/controllers/notification.controller'
import type { NotificationsResponse, UserNotification } from '@/interface/notification.interface'

const PAGE_LIMIT = 10
const dateFormat = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Bangkok',
})

function notificationIcon(type: UserNotification['type']) {
  return type === NOTIFICATION_TYPE.WITHDRAWAL_APPROVED || type === NOTIFICATION_TYPE.WRITER_APPLICATION_APPROVED
    ? CheckCircle2
    : CircleX
}

function notificationColor(type: UserNotification['type']) {
  return type === NOTIFICATION_TYPE.WITHDRAWAL_APPROVED || type === NOTIFICATION_TYPE.WRITER_APPLICATION_APPROVED
    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
    : 'bg-destructive/10 text-destructive'
}

function NotificationsSkeleton() {
  return <div className="space-y-3">{Array.from({ length: 5 }, (_, index) => <div key={index} className="rounded-2xl border p-5"><Skeleton className="h-5 w-48" /><Skeleton className="mt-3 h-4 w-full" /><Skeleton className="mt-2 h-4 w-3/5" /><Skeleton className="mt-4 h-3 w-32" /></div>)}</div>
}

export function Notifications() {
  const router = useRouter()
  const { accessToken, status } = useAuth()
  const [data, setData] = useState<NotificationsResponse | null>(null)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)
    try {
      setData(await getNotifications(page, PAGE_LIMIT, accessToken))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'ไม่สามารถโหลดการแจ้งเตือนได้')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!accessToken) {
      if (status !== 'loading') setIsLoading(false)
      return
    }
    void load()
    // The request is scoped to the active session and selected page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, page, status])

  async function openNotification(notification: UserNotification) {
    if (!accessToken) return
    try {
      if (!notification.read_at) {
        const result = await markNotificationRead(notification.id, accessToken)
        setData((current) => current ? {
          ...current,
          notifications: current.notifications.map((item) => item.id === notification.id ? result.notification : item),
        } : current)
      }
      router.push(notification.target_url ?? '/notifications')
    } catch (readError) {
      toast.error(readError instanceof Error ? readError.message : 'ไม่สามารถเปิดการแจ้งเตือนได้')
    }
  }

  const pageStart = data?.pagination.total ? (data.pagination.page - 1) * data.pagination.limit + 1 : 0
  const pageEnd = data ? Math.min(data.pagination.page * data.pagination.limit, data.pagination.total) : 0

  return (
    <main className="mx-auto min-h-[calc(100vh-4.35rem)] w-full max-w-3xl px-4 py-8 md:px-8 md:py-10">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold tracking-[-0.025em] md:text-3xl"><Bell className="size-6 text-primary" />การแจ้งเตือน</h1><p className="mt-1 text-sm text-muted-foreground">ติดตามสถานะคำขอและรายการสำคัญของคุณ</p></div>
        <Button variant="outline" size="icon" aria-label="โหลดการแจ้งเตือนใหม่" title="โหลดใหม่" disabled={isLoading} onClick={() => void load()}><RefreshCw className={isLoading ? 'animate-spin' : ''} /></Button>
      </div>

      <section className="mt-6" aria-busy={isLoading}>
        {isLoading && !data ? <NotificationsSkeleton /> : error && !data ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center"><p className="font-medium text-destructive">{error}</p><Button variant="outline" className="mt-4" onClick={() => void load()}>ลองใหม่</Button></div>
        ) : data?.notifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center"><Bell className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-semibold">ยังไม่มีการแจ้งเตือน</p><p className="mt-1 text-sm text-muted-foreground">เมื่อมีการอัปเดตสำคัญ ระบบจะแจ้งให้คุณทราบที่นี่</p></div>
        ) : (
          <div className="space-y-3">
            {data?.notifications.map((notification) => {
              const Icon = notificationIcon(notification.type)
              return <button key={notification.id} type="button" onClick={() => void openNotification(notification)} className={`w-full rounded-2xl border p-5 text-left transition-colors hover:bg-accent/50 ${notification.read_at ? 'bg-card' : 'border-primary/25 bg-primary/5'}`}>
                <div className="flex items-start gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${notificationColor(notification.type)}`}><Icon className="size-5" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-start justify-between gap-2"><span className="font-semibold">{notification.title}</span>{!notification.read_at && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">ใหม่</span>}</span><span className="mt-1.5 block whitespace-pre-line text-sm leading-6 text-muted-foreground">{notification.message}</span><span className="mt-3 block text-xs text-muted-foreground">{dateFormat.format(new Date(notification.created_at))}</span></span></div>
              </button>
            })}
          </div>
        )}
      </section>

      {data && data.pagination.total_pages > 1 && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><span>แสดง {pageStart}–{pageEnd} จาก {data.pagination.total} รายการ</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => current - 1)}>ก่อนหน้า</Button><Button size="sm" variant="outline" disabled={page >= data.pagination.total_pages || isLoading} onClick={() => setPage((current) => current + 1)}>ถัดไป</Button></div></div>}
    </main>
  )
}
