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
  )
}
