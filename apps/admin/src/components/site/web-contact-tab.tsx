'use client'

/**
 * components/site/web-contact-tab.tsx — แท็บ "ช่องทางติดต่อ" (2026-08-18, ใหม่)
 *
 * ตาราง web_contacts มีมาตั้งแต่ migration 001 (ใช้กับ Footer อยู่แล้ว) แต่ไม่เคยมี admin CRUD —
 * หน้านี้เพิ่มให้จริง ลบถาวรได้เลย (ไม่มีอะไรอ้างอิง FK มาที่ตารางนี้ ต่างจาก categories)
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WebContactDialog } from './web-contact-dialog'
import { api } from '@/lib/api'
import type { WebContactAdminRow } from '@/types'

export function WebContactTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WebContactAdminRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'web-contacts'],
    queryFn: () => api.get<{ data: WebContactAdminRow[] }>('/admin/web-contacts').then((res) => res.data),
  })

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'web-contacts'] })
  }

  async function handleDelete(row: WebContactAdminRow) {
    if (!window.confirm(`ลบช่องทางติดต่อ "${row.label}" ถาวรใช่หรือไม่?`)) return
    setError(null)
    setBusyId(row.id)
    try {
      await api.delete(`/admin/web-contacts/${row.id}`)
      refetch()
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
          ลิงก์ช่องทางติดต่อภายนอก (Discord/Facebook/Line/อีเมล ฯลฯ) — แสดงที่ Footer และหน้า
          &quot;ติดต่อแอดมิน&quot; ของนักอ่าน
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
          <p className="text-sm text-muted-foreground">ยังไม่มีช่องทางติดต่อ — กด &quot;เพิ่ม&quot; เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">{row.label}</span>
                  {!row.status && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">ซ่อนอยู่</span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">{row.url}</p>
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

      <WebContactDialog contact={editing} open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={refetch} />
    </div>
  )
}
