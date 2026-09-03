'use client'

/**
 * app/(dashboard)/history/page.tsx — "ประวัติ" (2026-08-04, ใหม่ — ต่อ backend จริงตามที่ user ขอ
 * "ให้ต่อให้ทำงานจริงไปเลย" ต่างจาก "ข้อความติดต่อ" ที่ปล่อยเป็น placeholder)
 *
 * เก็บ record ทุก action ที่เกิดในระบบหลังบ้าน (ใครทำอะไร/อนุมัติอะไรจากใคร) — ผูกกับ
 * getAuditLogs()/getAuditLogEventTypes() ที่มีอยู่แล้วแต่ไม่เคยมี UI (audit_logs เขียนไว้ทุก action
 * สำคัญอยู่แล้วผ่าน writeAuditLog() — ban/suspend/level/flag/withdrawal/carousel/settings ฯลฯ)
 *
 * "อนุมัติอะไรจากใคร": เพิ่ม APPROVE_ADMIN_REQUEST/REJECT_ADMIN_REQUEST log ใหม่ในรอบนี้ด้วย
 * (เดิม approveAdminActionRequest ไม่เคยเขียน log ของตัวเอง มีแค่ log ของ BAN_USER/SET_LEVEL ที่
 * เรียกซ้อนอยู่ข้างในซึ่งไม่มีบริบทว่า "มาจากคำขอของใคร") — ดู admin.service.ts
 *
 * ล็อก level >= 9 ตรงกับ backend, กรองได้ทั้งประเภท (event_type) และค้นข้อความ/ชื่อแอดมิน
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, History as HistoryIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatCompactNumber, formatThaiDateTime } from '@/lib/utils'
import { useAdminUser } from '@/store/auth.store'
import type { AuditLogRow, Pagination } from '@/types'

export default function HistoryPage() {
  const me = useAdminUser()
  const myLevel = me?.level ?? 0

  if (myLevel < 9) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">ประวัติ</h1>
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          ต้องเป็นแอดมินรองขึ้นไป (level ≥ 9) ถึงจะเข้าดูแท็บนี้ได้
        </p>
      </div>
    )
  }

  return <AuditLogTable />
}

function AuditLogTable() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [eventType, setEventType] = useState('')
  const [page, setPage] = useState(1)

  const typesQuery = useQuery({
    queryKey: ['admin', 'audit-log-event-types'],
    queryFn: () => api.get<{ data: string[] }>('/admin/audit-logs/event-types'),
  })

  const query = useQuery({
    queryKey: ['admin', 'audit-logs', eventType, search, page],
    queryFn: () => {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '50')
      if (eventType) params.set('event_type', eventType)
      if (search) params.set('search', search)
      return api.get<{ data: AuditLogRow[]; pagination: Pagination }>(`/admin/audit-logs?${params.toString()}`)
    },
  })

  const rows = query.data?.data ?? []
  const pagination = query.data?.pagination
  const eventTypes = typesQuery.data?.data ?? []

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">ประวัติ</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          setSearch(searchInput.trim())
        }}
        className="mb-4 flex flex-wrap items-end gap-3"
      >
        <div className="min-w-[240px] flex-1">
          <label className="mb-1.5 block text-sm font-medium text-foreground">ค้นหา</label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ข้อความ / ชื่อแอดมินที่ทำรายการ"
              className="pl-9"
            />
          </div>
        </div>

        <div className="w-56">
          <label className="mb-1.5 block text-sm font-medium text-foreground">ประเภท</label>
          <Select
            value={eventType}
            onChange={(e) => {
              setPage(1)
              setEventType(e.target.value)
            }}
          >
            <option value="">ทั้งหมด</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>

        <Button type="submit">ค้นหา</Button>
      </form>

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
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-foreground">{r.admin_name}</div>
                  </td>
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
            หน้า {pagination.page} / {pagination.pages} (ทั้งหมด {formatCompactNumber(pagination.total)} รายการ)
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
