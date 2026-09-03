'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Banknote,
  BarChart3,
  BookOpen,
  ChevronDown,
  FileText,
  Flag,
  Heart,
  Home,
  LibraryBig,
  ListOrdered,
  MessageSquare,
  Unlock,
  UserCog,
  Eye,
} from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { getWriterStats } from '@/lib/api'
import type { WriterStats } from '@/interface/writer-stats.interface'

const writerNavigation = [
  { href: '/writer', label: 'แดชบอร์ด', icon: BarChart3, enabled: true },
  { href: '/writer/stories', label: 'นิยาย', icon: BookOpen, enabled: false },
  { href: '/writer/withdrawals', label: 'ถอนเงิน', icon: Banknote, enabled: false },
  { href: '/writer/reports', label: 'รายงานที่ได้รับ', icon: Flag, enabled: false },
] as const

const writerInformationNavigation = [
  { label: 'ข้อมูลนักเขียน', icon: UserCog },
  { label: 'ข่าวสาร', icon: MessageSquare },
  { label: 'ข้อกำหนดการใช้งาน', icon: FileText },
] as const

const statCards = [
  { key: 'story_count', label: 'จำนวนเรื่อง', icon: LibraryBig },
  { key: 'chapter_count', label: 'จำนวนตอน', icon: ListOrdered },
  { key: 'total_views', label: 'จำนวนยอดวิว', icon: Eye },
  { key: 'favorite_count', label: 'จำนวนคนชื่นชอบ', icon: Heart },
  { key: 'free_chapter_count', label: 'จำนวนตอนฟรี', icon: Unlock },
] as const

function DisabledNavigationItem({
  icon: Icon,
  label,
}: {
  icon: typeof BarChart3
  label: string
}) {
  return (
    <span
      aria-disabled="true"
      title="ยังไม่เปิดใช้งาน"
      className="flex min-h-10 cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground opacity-55"
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.8} />
      <span>{label}</span>
    </span>
  )
}

export default function WriterPage() {
  const pathname = usePathname()
  const router = useRouter()
  const { accessToken, status, user } = useAuth()
  const [stats, setStats] = useState<WriterStats | null>(null)
  const [statsError, setStatsError] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
      return
    }

    if (status === 'authenticated' && user?.role !== 'writer') {
      router.replace('/')
    }
  }, [router, status, user])

  useEffect(() => {
    if (!accessToken || user?.role !== 'writer') return

    let cancelled = false
    setStatsError(false)

    void getWriterStats(accessToken)
      .then(({ stats: nextStats }) => {
        if (!cancelled) setStats(nextStats)
      })
      .catch(() => {
        if (!cancelled) setStatsError(true)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, user])

  if (status === 'loading' || status === 'unauthenticated' || user?.role !== 'writer') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">กำลังตรวจสอบสิทธิ์...</p>
      </div>
    )
  }

  const userInitial = user.display_name.trim().charAt(0)
    || user.username.trim().charAt(0)
    || '?'
  const formattedBalance = new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(user.balance))

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="flex min-h-screen w-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-screen md:w-64 md:min-h-0 md:shrink-0">
        <div className="px-5 pt-6 pb-5">
          <p className="text-lg font-bold tracking-[-0.025em]">หน้านักเขียน</p>
        </div>

        <div className="mx-4 rounded-2xl bg-sidebar-accent px-4 py-3.5">
          <p className="text-xs font-medium text-muted-foreground">ยอดเงินคงเหลือ</p>
          <p className="mt-0.5 text-xl font-bold text-primary">฿{formattedBalance}</p>
        </div>

        <nav className="mt-3 flex flex-1 flex-col px-3 pb-3" aria-label="เมนูนักเขียน">
          <div className="space-y-0.5">
            {writerNavigation.map(({ enabled, href, icon: Icon, label }) => (
              enabled ? (
                <Link
                  key={href}
                  href={href}
                  aria-current={pathname === href ? 'page' : undefined}
                  className="flex min-h-10 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-sidebar-accent data-[active]:bg-sidebar-primary data-[active]:text-white"
                  data-active={pathname === href || undefined}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.8} />
                  <span>{label}</span>
                </Link>
              ) : (
                <DisabledNavigationItem key={href} icon={Icon} label={label} />
              )
            ))}
          </div>

          <div className="my-2 border-t border-sidebar-border" />

          <div className="space-y-0.5">
            {writerInformationNavigation.map(({ icon, label }) => (
              <DisabledNavigationItem key={label} icon={icon} label={label} />
            ))}
            <Link
              href="/"
              className="flex min-h-10 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-sidebar-accent"
            >
              <Home className="size-4 shrink-0" strokeWidth={1.8} />
              <span>กลับหน้าแรก</span>
            </Link>
          </div>
        </nav>

        <footer className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-white">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="size-full object-cover" />
              ) : userInitial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{user.display_name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </footer>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold text-primary">WRITER STUDIO</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.025em] md:text-3xl">แดชบอร์ดนักเขียน</h1>
          {statsError ? (
            <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
              ไม่สามารถโหลดสถิตินักเขียนได้ กรุณาลองใหม่อีกครั้ง
            </div>
          ) : (
            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="สถิตินักเขียน">
              {statCards.map(({ key, label, icon: Icon }) => (
                <article key={key} className="readji-surface rounded-2xl p-5">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
                    <Icon className="size-5" strokeWidth={1.8} />
                  </div>
                  <p className="mt-4 text-sm font-medium text-muted-foreground">{label}</p>
                  {stats ? (
                    <p className="mt-1 text-2xl font-bold tracking-[-0.025em]">
                      {new Intl.NumberFormat('th-TH').format(Number(stats[key]))}
                    </p>
                  ) : (
                    <div className="mt-2 h-7 w-16 animate-pulse rounded-md bg-muted" aria-label={`กำลังโหลด${label}`} />
                  )}
                </article>
              ))}
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
