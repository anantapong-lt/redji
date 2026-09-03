'use client'

/**
 * components/site/site-history-tab.tsx — แท็บ "ประวัติ" ย่อยใน "ตั้งหน้าเว็บไซต์" (2026-08-04, ใหม่)
 *
 * ต่างจากหน้า "ประวัติ" ใหญ่ (/history, ครอบคลุมทุก action ในระบบ) — อันนี้กรองเฉพาะ event
 * ที่เกี่ยวกับ carousel/นิยายแนะนำเท่านั้น (ผ่าน event_types param ที่เพิ่มใน getAuditLogs())
 * ตามที่ user ขอ "ประวัติข้อมูลที่ได้แก้และเพิ่มไป มีกรองมีอะไรให้อย่างที่ควรจะมี"
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History as HistoryIcon } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatThaiDateTime } from '@/lib/utils'
import type { AuditLogRow, Pagination } from '@/types'

const CAROUSEL_EVENTS = ['CREATE_CAROUSEL', 'UPDATE_CAROUSEL', 'DELETE_CAROUSEL', 'REORDER_CAROUSEL']
const FEATURED_EVENTS = ['ADD_FEATURED_WORK', 'REMOVE_FEATURED_WORK', 'REORDER_FEATURED_WORK']
const ALL_EVENTS = [...CAROUSEL_EVENTS, ...FEATURED_EVENTS]

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'featured', label: 'นิยายแนะนำ' },
] as const

export function SiteHistoryTab() {
  const [category, setCategory] = useState<'all' | 'carousel' | 'featured'>('all')
  const [page, setPage] = useState(1)

  const eventTypes =
    category === 'carousel' ? CAROUSEL_EVENTS : category === 'featured' ? FEATURED_EVENTS : ALL_EVENTS

  const query = useQuery({
    queryKey: ['admin', 'site-history', category, page],
    queryFn: () =>
      api.get<{ data: AuditLogRow[]; pagination: Pagination }>(
        `/admin/audit-logs?page=${page}&limit=30&event_types=${eventTypes.join(',')}`,
      ),
  })

  const rows = query.data?.data ?? []
  const pagination = query.data?.pagination

  return (
    <div>
      <div className="mb-4 w-56">
        <label className="mb-1.5 block text-sm font-medium text-foreground">ประเภท</label>
        <Select
          value={category}
          onChange={(e) => {
            setPage(1)
            setCategory(e.target.value as typeof category)
          }}
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium whitespace-nowrap">เวลา</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">แอดมิน</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">ประเภท</th>
              <th className="px-4 py-3 font-medium">รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  กำลังโหลด...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <HistoryIcon className="size-6 text-muted-foreground" />
                    ไม่พบ record ที่ตรงกับเงื่อนไข
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatThaiDateTime(r.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{r.admin_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {r.event_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{r.description}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <Button variant="outline" className="h-8 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ก่อนหน้า
          </Button>
          <span>
            หน้า {pagination.page} / {pagination.pages}
          </span>
          <Button
            variant="outline"
            className="h-8 text-xs"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            ถัดไป
          </Button>
        </div>
      )}
    </div>
  )
}
