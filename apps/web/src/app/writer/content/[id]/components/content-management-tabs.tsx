'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-provider'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getWriterContent } from '@/controllers/writer.controller'
import { ApiError } from '@/lib/api-client'

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
  const { accessToken } = useAuth()
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
            router.replace('/writer/contents')
            return
          }
          setTitle(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, contentId, router])

  return (
    <div className="space-y-2">
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
              className="h-9 flex-1 rounded-lg px-3 text-center text-sm font-semibold text-muted-foreground shadow-none hover:bg-accent hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
            >
              <Link href={`/writer/content/${contentId}/${value}`}>{label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
