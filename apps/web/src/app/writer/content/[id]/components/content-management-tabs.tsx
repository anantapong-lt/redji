'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
  const activeTab = tabs.find(({ value }) => (
    pathname === `/writer/content/${contentId}/${value}`
    || pathname.startsWith(`/writer/content/${contentId}/${value}/`)
  ))?.value
    ?? 'overview'

  return (
    <Tabs value={activeTab} className="block">
      <TabsList
        aria-label="เมนูจัดการเนื้อหา"
        className="readji-surface flex h-auto w-full rounded-2xl bg-white p-1.5"
      >
        {tabs.map(({ value, label }) => (
          <TabsTrigger
            key={value}
            value={value}
            asChild
            className="h-auto flex-1 rounded-xl px-5 py-3 text-center text-sm font-bold text-muted-foreground shadow-none hover:bg-accent hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            <Link href={`/writer/content/${contentId}/${value}`}>{label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
