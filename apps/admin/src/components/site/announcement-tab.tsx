'use client'

/**
 * components/site/announcement-tab.tsx — แท็บ "ประกาศ" (2026-08-11, ใหม่)
 *
 * รายการประกาศทั้งหมด (รวม inactive — ?all=true) เพิ่ม/แก้ไขผ่าน AnnouncementDialog, ลบทันที
 * (มี confirm ของตัวเอง เหมือน carousel-tab.tsx) — ไม่มีการลาก-จัดลำดับแบบ Carousel เพราะฝั่ง
 * public (AnnouncementBar) โชว์แค่ประกาศ active ล่าสุดอันเดียวเสมอ (เรียงตาม created_at) ไม่ใช่
 * รายการที่ต้องจัดลำดับเอง
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnnouncementDialog } from './announcement-dialog'
import { api } from '@/lib/api'
import { formatThaiDateTime } from '@/lib/utils'
import type { AnnouncementRow } from '@/types'

const COLOR_DOT: Record<string, string> = {
  green: 'bg-gradient-to-br from-emerald-500 to-green-700',
  red: 'bg-gradient-to-br from-red-500 to-rose-700',
  purple: 'bg-gradient-to-br from-purple-500 to-violet-700',
  gold: 'bg-gradient-to-br from-amber-400 to-yellow-600',
}

export function AnnouncementTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AnnouncementRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'announcements'],
    queryFn: () => api.get<{ data: AnnouncementRow[] }>('/admin/announcements?all=true').then((res) => res.data),
  })

  async function handleDelete(row: AnnouncementRow) {
    if (!window.confirm(`ลบประกาศ "${row.title}" ใช่หรือไม่?`)) return
    setError(null)
    setBusyId(row.id)
    try {
      await api.delete(`/admin/announcements/${row.id}`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] })
    } catch (err: any) {
      setError(err?.message ?? 'ลบไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusyId(null)
    }
  }

  const rows = query.data ?? []

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          ประกาศที่ &quot;เปิดใช้งาน&quot; ขึ้นเป็นแถบยาวเหนือ Carousel หน้าแรก — โชว์ได้ทีละ 1 อัน
          (อันที่เปิดอยู่แล้วสร้าง/แก้ล่าสุดจะขึ้นก่อน)
        </p>
        <Button
          type="button"
          className="h-9 shrink-0 gap-1.5"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="size-4" />
          เพิ่ม
        </Button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {query.isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card py-16">
          <p className="text-sm text-muted-foreground">ยังไม่มีประกาศ — กด &quot;เพิ่ม&quot; เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <span className={`size-8 shrink-0 rounded-full ${COLOR_DOT[row.color] ?? COLOR_DOT.gold}`} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">{row.title}</span>
                  {row.status === 'inactive' && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">ปิดใช้งาน</span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">{row.content}</p>
              </div>

              <div className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                {formatThaiDateTime(row.created_at)}
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(row)
                    setDialogOpen(true)
                  }}
                  className="flex cursor-pointer items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Pencil className="size-3.5" />
                  แก้ไข
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => handleDelete(row)}
                  className="flex cursor-pointer items-center gap-1 text-sm text-destructive hover:underline disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                  ลบ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnnouncementDialog
        announcement={editing}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] })}
      />
    </div>
  )
}
