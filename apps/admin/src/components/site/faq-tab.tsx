'use client'

/**
 * components/site/faq-tab.tsx — แท็บ "FAQ" (2026-08-18, ใหม่)
 * คำถามที่พบบ่อยของหน้า "ติดต่อแอดมิน" ฝั่งนักอ่าน — ลบถาวรได้เลย (ไม่มี FK อ้างอิงมาที่ตารางนี้)
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FaqDialog } from './faq-dialog'
import { api } from '@/lib/api'
import type { FaqAdminRow } from '@/types'

export function FaqTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FaqAdminRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'faqs'],
    queryFn: () => api.get<{ data: FaqAdminRow[] }>('/admin/faqs').then((res) => res.data),
  })

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'faqs'] })
  }

  async function handleDelete(row: FaqAdminRow) {
    if (!window.confirm(`ลบคำถาม "${row.question}" ถาวรใช่หรือไม่?`)) return
    setError(null)
    setBusyId(row.id)
    try {
      await api.delete(`/admin/faqs/${row.id}`)
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
        <p className="text-sm text-muted-foreground">คำถามที่พบบ่อย — แสดงในหน้า &quot;ติดต่อแอดมิน&quot; ของนักอ่าน</p>
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
          <p className="text-sm text-muted-foreground">ยังไม่มีคำถามที่พบบ่อย — กด &quot;เพิ่ม&quot; เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{row.question}</span>
                  {!row.status && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">ซ่อนอยู่</span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.answer}</p>
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

      <FaqDialog faq={editing} open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={refetch} />
    </div>
  )
}
