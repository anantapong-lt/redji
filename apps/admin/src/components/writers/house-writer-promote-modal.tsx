'use client'

/**
 * components/writers/house-writer-promote-modal.tsx — "+ เพิ่มนักเขียนของเว็บ" (2026-08-10, ใหม่)
 *
 * ไม่มีหน้า "ผู้ใช้" แบบตั้ง level ได้ทั่วไปในระบบนี้เลย (เข้าใจผิดตอนแรกว่ามี) — ปุ่มนี้เลยเป็นทางเดียว
 * ที่ตั้งบัญชีไหนก็ได้ให้เป็น level 7 ได้จริง ค้นหาชื่อ/username (ไม่กรอง level) แล้วกด "ตั้งเป็น
 * นักเขียนของเว็บ" ทีละคน — level >= 8 ตั้งไม่ได้ (ปุ่มไม่โผล่ให้กดเลย กันกดพลาดใส่บัญชีแอดมิน backend
 * เองก็เช็คซ้ำอีกชั้นผ่าน assertCanModerate/ADMIN_MANAGED_LEVELS อยู่แล้ว)
 */

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { AdminUserRow } from '@/types'

export function HouseWriterPromoteModal({
  onClose,
  onPromoted,
}: {
  onClose: () => void
  onPromoted: (u: AdminUserRow) => void
}) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [searching, setSearching] = useState(false)
  const [promotingUuid, setPromotingUuid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  async function handleSearch(term: string) {
    setSearch(term)
    if (!term.trim()) {
      setRows([])
      setSearched(false)
      return
    }
    setSearching(true)
    setError(null)
    try {
      const res = await api.get<{ data: AdminUserRow[] }>(
        `/admin/users?search=${encodeURIComponent(term.trim())}&limit=20`,
      )
      setRows(res.data)
      setSearched(true)
    } catch (err: any) {
      setError(err?.message ?? 'ค้นหาไม่สำเร็จ')
    } finally {
      setSearching(false)
    }
  }

  async function handlePromote(u: AdminUserRow) {
    if (!confirm(`ตั้ง "${u.display_name}" (@${u.u_name}) เป็นนักเขียนของเว็บ?\n\nบัญชีนี้จะกลายเป็น level 7 ทันที`)) return

    setError(null)
    setPromotingUuid(u.uuid)
    try {
      await api.patch(`/admin/users/${u.uuid}/level`, { level: 7 })
      queryClient.invalidateQueries({ queryKey: ['admin', 'house-writers'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      onPromoted({ ...u, level: 7 })
    } catch (err: any) {
      setError(err?.message ?? 'ตั้งเป็นนักเขียนของเว็บไม่สำเร็จ')
    } finally {
      setPromotingUuid(null)
    }
  }

  return (
    <Modal open onClose={onClose} title="เพิ่มนักเขียนของเว็บ">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          ค้นหาบัญชีผู้ใช้ที่มีอยู่แล้ว (ชื่อ/username) แล้วตั้งให้เป็น &quot;นักเขียนของเว็บ&quot; (level 7) — ตั้งได้เฉพาะบัญชีที่ level ต่ำกว่าแอดมินเท่านั้น
        </p>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
            placeholder="พิมพ์ชื่อหรือ username..."
            className="h-10 w-full rounded-lg border border-input bg-transparent pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
          {searching ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">กำลังค้นหา...</p>
          ) : !searched ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">พิมพ์เพื่อค้นหาบัญชี</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">ไม่พบบัญชีที่ค้นหา</p>
          ) : (
            rows.map((u) => (
              <div
                key={u.uuid}
                className="flex items-center justify-between border-b border-border px-4 py-2.5 last:border-0"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">{u.display_name}</div>
                  <div className="text-xs text-muted-foreground">
                    @{u.u_name} · level {u.level}
                    {u.level === 7 && ' (เป็นนักเขียนของเว็บอยู่แล้ว)'}
                  </div>
                </div>
                {u.level === 7 ? (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    เลือกได้ที่ลิสต์
                  </span>
                ) : u.level < 8 ? (
                  <Button
                    variant="outline"
                    className="h-7 shrink-0 text-xs"
                    disabled={promotingUuid === u.uuid}
                    onClick={() => handlePromote(u)}
                  >
                    {promotingUuid === u.uuid ? 'กำลังตั้ง...' : 'ตั้งเป็นนักเขียนของเว็บ'}
                  </Button>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">เป็นแอดมิน — ตั้งไม่ได้</span>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            ปิด
          </Button>
        </div>
      </div>
    </Modal>
  )
}
