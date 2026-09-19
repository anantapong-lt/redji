'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-provider'
import { getWriterStats } from '@/controllers/writer.controller'
import type { WriterDashboardData, WriterDashboardPeriod, WriterStats } from '@/interface/writer-stats.interface'
import { userRole } from '@/interface/user.interface'
import { SITE_CONFIG } from '@/site.config'
import { WriterDashboardCharts } from './components/writer-dashboard-charts'
import { WriterStatsSection } from './components/writer-stats-section'

export default function WriterPage() {
  const { accessToken, user } = useAuth()
  const searchParams = useSearchParams()
  const contentId = searchParams.get('content_id') ?? undefined
  const [stats, setStats] = useState<WriterStats | null>(null)
  const [dashboard, setDashboard] = useState<WriterDashboardData | null>(null)
  const [period, setPeriod] = useState<WriterDashboardPeriod>('this-month')
  const [statsError, setStatsError] = useState(false)

  useEffect(() => {
    if (!accessToken || !user) return
    if (user.role === userRole.SUPER_ADMIN && !contentId) {
      setStatsError(true)
      setStats(null)
      setDashboard(null)
      return
    }
    if (user.role !== userRole.WRITER && user.role !== userRole.SUPER_ADMIN) return

    let cancelled = false
    setStatsError(false)
    setStats(null)
    setDashboard(null)

    void getWriterStats(period, accessToken, contentId)
      .then((nextDashboard) => {
        if (!cancelled) {
          setStats(nextDashboard.stats)
          setDashboard(nextDashboard)
        }
      })
      .catch(() => {
        if (!cancelled) setStatsError(true)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, contentId, user, period])

  return (
    <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto">
        {user?.role === userRole.SUPER_ADMIN && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
            <span className="font-medium text-foreground">คุณกำลังดูแดชบอร์ดของนักเขียนด้วยสิทธิ์แอดมิน</span>
            <a href={`${SITE_CONFIG.adminUrl}/works`} className="font-semibold text-primary underline-offset-4 hover:underline">
              กลับหน้าผลงานทั้งหมด
            </a>
          </div>
        )}
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.025em] md:text-3xl">แดชบอร์ดนักเขียน</h1>
        <WriterStatsSection stats={stats} hasError={statsError} />
        <WriterDashboardCharts data={dashboard} period={period} onPeriodChange={setPeriod} hasError={statsError} />
      </div>
    </main>
  )
}
