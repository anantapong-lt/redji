'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-provider'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getWriterContent } from '@/controllers/writer.controller'
import { userRole } from '@/interface/user.interface'
import { ApiError } from '@/lib/api-client'
import { SITE_CONFIG } from '@/site.config'

interface ContentManagementTabsProps {
  contentId: string
}

const tabs = [
  { value: 'overview', label: 'ภาพรวม' },
  { value: 'content', label: 'เนื้อหา' },
  { value: 'chapters', label: 'ตอน' },
] as const

export function ContentManagementTabs({ contentId }: ContentManagementTabsProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { accessToken, user } = useAuth()
  const [title, setTitle] = useState<string | null>(null)
  const activeTab = tabs.find(({ value }) => (
    pathname === `/writer/content/${contentId}/${value}`
    || pathname.startsWith(`/writer/content/${contentId}/${value}/`)
  ))?.value
    ?? 'overview'

  useEffect(() => {
    if (!accessToken) return

    let cancelled = false
    void getWriterContent(contentId, accessToken)
      .then(({ story }) => {
        if (!cancelled) setTitle(story.title)
      })
      .catch((error) => {
        if (!cancelled) {
          if (error instanceof ApiError && error.status === 404) {
            if (user?.role === userRole.SUPER_ADMIN) {
              window.location.replace(`${SITE_CONFIG.adminUrl}/works`)
            } else {
              router.replace('/writer/contents')
            }
            return
          }
          setTitle(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, contentId, router, user?.role])

  return (
    <div className="space-y-2">
      {user?.role === userRole.SUPER_ADMIN && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <span className="font-medium text-foreground">คุณกำลังจัดการเรื่องนี้ด้วยสิทธิ์แอดมิน</span>
          <a
            href={`${SITE_CONFIG.adminUrl}/works`}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            กลับหน้าผลงานทั้งหมด
          </a>
        </div>
      )}
      {title ? (
        <h1 className="truncate text-xl font-extrabold text-foreground" title={title}>เรื่อง: {title}</h1>
      ) : accessToken ? (
        <Skeleton className="h-7 w-64 max-w-full" />
      ) : null}
      <Tabs value={activeTab} className="block">
        <TabsList
          aria-label="เมนูจัดการเนื้อหา"
          className="readji-surface flex h-auto w-full rounded-xl bg-white p-1"
        >
          {tabs.map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              asChild
              className="h-9 flex-1 rounded-lg px-3 text-center text-sm font-semibold text-muted-foreground shadow-none hover:bg-accent hover:text-foreground data-[state=active]:shadow-none"
              style={activeTab === value ? {
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
              } : undefined}
            >
              <Link href={`/writer/content/${contentId}/${value}`}>{label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
