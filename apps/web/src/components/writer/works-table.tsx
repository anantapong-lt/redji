'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Wrench, BarChart3, Ban, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { CategoryChips } from '@/components/home/category-chips'
import { WorkStatsDialog } from './work-stats-dialog'
import type { CategoryRef, AgeRate } from '@/types'

// รูปทรงตรงกับ GET /writer/works จริง (ดู writer.service.ts getMyWorks)
export interface WriterWorkRow {
  uuid: string
  title: string
  cover_image: string | null
  category_main: CategoryRef | null
  category_sub: CategoryRef | null
  extra_category_count: number
  tags: string[]
  sales: number
  age_rate: AgeRate // ระดับความเหมาะสมของเนื้อหา — "ทั่วไป" หรือ "18+"
  publish_status: 0 | 1
}

const AGE_RATE_LABEL: Record<AgeRate, string> = {
  all: 'ทั่วไป',
  '18+': '18+',
}

function AgeRateBadge({ rate }: { rate: AgeRate }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        rate === '18+' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground',
      )}
    >
      {AGE_RATE_LABEL[rate]}
    </span>
  )
}

function PublishBadge({ status }: { status: 0 | 1 }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        status === 1 ? 'bg-teal-100 text-teal-700' : 'bg-muted text-muted-foreground',
      )}
    >
      {status === 1 ? 'เผยแพร่' : 'ซ่อน'}
    </span>
  )
}

function ActionButton({
  icon: Icon,
  colorClass,
  label,
  href,
  target,
  disabled,
  onClick,
}: {
  icon: typeof Wrench
  colorClass: string
  label: string
  href?: string
  target?: string
  disabled?: boolean
  onClick?: () => void
}) {
  const className = cn(
    'flex size-8 cursor-pointer items-center justify-center rounded-lg text-white transition-opacity hover:opacity-90',
    disabled && 'pointer-events-none opacity-50',
    colorClass,
  )

  if (href) {
    return (
      <Link href={href} target={target} rel={target === '_blank' ? 'noopener noreferrer' : undefined} aria-label={label} title={label} className={className}>
        <Icon className="size-4" />
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={className}>
      <Icon className="size-4" />
    </button>
  )
}

export function WorksTable({
  works,
  onDeleted,
}: {
  works: WriterWorkRow[]
  onDeleted: (uuid: string) => void
}) {
  const [statsWork, setStatsWork] = useState<{ uuid: string; title: string } | null>(null)
  const [deletingUuid, setDeletingUuid] = useState<string | null>(null)

  async function handleDelete(work: WriterWorkRow) {
    if (!window.confirm(`ลบผลงาน "${work.title}"? การกระทำนี้ย้อนกลับไม่ได้ผ่านหน้านี้`)) return
    setDeletingUuid(work.uuid)
    try {
      await api.delete(`/writer/works/${work.uuid}`)
      onDeleted(work.uuid)
    } catch (err: any) {
    } finally {
      setDeletingUuid(null)
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="w-20 px-4 py-3 text-center font-medium">ปก</th>
            <th className="px-4 py-3 font-medium">ชื่อเรื่อง</th>
            <th className="px-4 py-3 text-center font-medium">หมวดหมู่</th>
            <th className="px-4 py-3 text-center font-medium">ยอดขาย</th>
            <th className="px-4 py-3 text-center font-medium">สถานะเนื้อหา</th>
            <th className="px-4 py-3 text-center font-medium">การเผยแพร่</th>
            <th className="px-4 py-3 text-right font-medium">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {works.map((work) => {
            const coverSrc = work.cover_image ?? '/novel-cover-placeholder.png'
            return (
              <tr key={work.uuid} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="relative mx-auto h-20 w-14 overflow-hidden rounded-md bg-muted">
                    <Image
                      src={coverSrc}
                      alt={work.title}
                      fill
                      sizes="56px"
                      unoptimized={coverSrc.startsWith('/')}
                      className="object-cover"
                    />
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{work.title}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <CategoryChips
                      categoryMain={work.category_main}
                      categorySub={work.category_sub}
                      tags={work.tags}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-center font-medium text-amber-600">
                  {work.sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-center">
                  <AgeRateBadge rate={work.age_rate} />
                </td>
                <td className="px-4 py-3 text-center">
                  <PublishBadge status={work.publish_status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <ActionButton
                      icon={Wrench}
                      colorClass="bg-amber-500"
                      label="จัดการตอน"
                      href={`/writer/works/${work.uuid}`}
                    />
                    <ActionButton
                      icon={BarChart3}
                      colorClass="bg-green-500"
                      label="สถิติ"
                      onClick={() => setStatsWork({ uuid: work.uuid, title: work.title })}
                    />
                    <ActionButton
                      icon={Ban}
                      colorClass="bg-red-500"
                      label="ลบผลงาน"
                      disabled={deletingUuid === work.uuid}
                      onClick={() => handleDelete(work)}
                    />
                    <ActionButton
                      icon={Send}
                      colorClass="bg-primary"
                      label="ดูหน้านิยายจริง"
                      href={`/works/${work.uuid}`}
                      target="_blank"
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <WorkStatsDialog
        workUuid={statsWork?.uuid ?? null}
        workTitle={statsWork?.title}
        open={statsWork !== null}
        onOpenChange={(v) => !v && setStatsWork(null)}
      />
    </div>
  )
}
