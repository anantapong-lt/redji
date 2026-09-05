'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import { getWriterStats } from '@/controllers/writer.controller'
import type { WriterStats } from '@/interface/writer-stats.interface'
import { userRole } from '@/interface/user.interface'
import { WriterStatsSection } from './components/writer-stats-section'

export default function WriterPage() {
  const { accessToken, user } = useAuth()
  const [stats, setStats] = useState<WriterStats | null>(null)
  const [statsError, setStatsError] = useState(false)

  useEffect(() => {
    if (!accessToken || user?.role !== userRole.WRITER) return

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

  return (
    <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto">
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.025em] md:text-3xl">แดชบอร์ดนักเขียน</h1>
        <WriterStatsSection stats={stats} hasError={statsError} />
      </div>
    </main>
  )
}
