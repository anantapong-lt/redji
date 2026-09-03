'use client'

/**
 * app/(dashboard)/users/page.tsx — จัดการผู้ใช้ (เวอร์ชันเต็ม, 2026-08-03, ข้อ 2 ของสเปค)
 *
 * ตารางลิสต์ + คลิกแถวเปิดหน้าต่างรายละเอียด (static+dynamic tabs — ดู user-detail-modal.tsx)
 *
 * 2026-08-03 แก้: เดิมมีคิว Flag แปะไว้ท้ายหน้านี้ด้วย — user ทักว่าผิด ("เลขหลักในสเปค = แท็บ
 * แยกกัน") Flag queue ต้องอยู่แท็บ "รายงาน" (ข้อ 5) ต่างหาก ย้ายออกไปแล้ว หน้านี้เหลือแค่
 * ตารางลิสต์ + หน้าต่างรายละเอียดตามขอบเขตของข้อ 2 เท่านั้น
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Ban, ShieldCheck, Pause, WalletCards } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { UserDetailModal } from '@/components/users/user-detail-modal'
import { api } from '@/lib/api'
import { formatCompactNumber, formatThaiDateTime } from '@/lib/utils'
import type { AdminUserRow, Pagination } from '@/types'

const LEVEL_OPTIONS = [
  { value: 1, label: '1 — นักอ่านทั่วไป' },
  { value: 6, label: '6 — นักเขียน' },
  { value: 8, label: '8 — แอดมินย่อย' },
  { value: 9, label: '9 — แอดมินรอง' },
  { value: 10, label: '10 — Shareholder' },
]

export default function UsersPage() {
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [bannedFilter, setBannedFilter] = useState('')
  const [page, setPage] = useState(1)
  const [viewingUuid, setViewingUuid] = useState<string | null>(null)

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', search, levelFilter, bannedFilter, page],
    queryFn: () => {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (search) params.set('search', search)
      if (levelFilter) params.set('level', levelFilter)
      if (bannedFilter) params.set('is_banned', bannedFilter)
      return api.get<{ data: AdminUserRow[]; pagination: Pagination }>(`/admin/users?${params.toString()}`)
    },
  })

  const users = usersQuery.data?.data ?? []
  const pagination = usersQuery.data?.pagination

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">จัดการผู้ใช้</h1>

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
              placeholder="ชื่อบัญชี / ชื่อที่แสดง / อีเมล"
              className="pl-9"
            />
          </div>
        </div>

        <div className="w-48">
          <label className="mb-1.5 block text-sm font-medium text-foreground">Level</label>
          <Select
            value={levelFilter}
            onChange={(e) => {
              setPage(1)
              setLevelFilter(e.target.value)
            }}
          >
            <option value="">ทั้งหมด</option>
            {LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-40">
          <label className="mb-1.5 block text-sm font-medium text-foreground">สถานะแบน</label>
          <Select
            value={bannedFilter}
            onChange={(e) => {
              setPage(1)
              setBannedFilter(e.target.value)
            }}
          >
            <option value="">ทั้งหมด</option>
            <option value="true">ถูกแบนอยู่</option>
            <option value="false">ไม่ถูกแบน</option>
          </Select>
        </div>

        <Button type="submit">ค้นหา</Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">ผู้ใช้</th>
              <th className="px-4 py-3 font-medium">อีเมล</th>
              <th className="px-4 py-3 font-medium">Level</th>
              <th className="px-4 py-3 font-medium">อ่าน/เดือน</th>
              <th className="px-4 py-3 font-medium">เหรียญที่ถือ</th>
              <th className="px-4 py-3 font-medium">ใช้ไป/เดือน</th>
              <th className="px-4 py-3 font-medium">สมัครเมื่อ</th>
              <th className="px-4 py-3 font-medium">Login ล่าสุด</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {usersQuery.isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  กำลังโหลด...
                </td>
              </tr>
            ) : usersQuery.isError ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-destructive">
                  โหลดข้อมูลไม่สำเร็จ
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.uuid} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{u.display_name}</div>
                    <div className="text-xs text-muted-foreground">@{u.u_name}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">{u.level}</td>
                  <td className="px-4 py-3" title={String(u.reads_month)}>{formatCompactNumber(u.reads_month)} ตอน</td>
                  <td className="px-4 py-3" title={String(u.point)}>{formatCompactNumber(u.point)}</td>
                  <td className="px-4 py-3" title={u.coins_spent_month ?? undefined}>{u.coins_spent_month == null ? '—' : formatCompactNumber(u.coins_spent_month)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatThaiDateTime(u.created_at)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.last_login_at ? formatThaiDateTime(u.last_login_at) : 'ไม่เคย'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.is_banned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                          <Ban className="size-3" />
                          แบน
                        </span>
                      )}
                      {u.is_activity_suspended && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                          <Pause className="size-3" />
                          ระงับ
                        </span>
                      )}
                      {u.is_spend_suspended && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                          <WalletCards className="size-3" />
                          ระงับใช้จ่าย
                        </span>
                      )}
                      {!u.is_banned && !u.is_activity_suspended && !u.is_spend_suspended && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                          <ShieldCheck className="size-3" />
                          ปกติ
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="outline" className="h-7 text-xs" onClick={() => setViewingUuid(u.uuid)}>
                      แก้ไข
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <Button
            variant="outline"
            className="h-8 text-xs"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
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

      <UserDetailModal uuid={viewingUuid} onClose={() => setViewingUuid(null)} />
    </div>
  )
}
