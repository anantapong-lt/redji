'use client'

/**
 * components/site/category-tab.tsx — แท็บ "หมวดหมู่" (2026-08-17, ใหม่)
 *
 * เดิมหมวดหมู่นิยายต้องแก้ผ่าน SQL migration ตรงๆ เท่านั้น ไม่มี UI เลย — หน้านี้เพิ่ม CRUD จริง
 * (เพิ่ม/แก้ชื่อ-ไอคอน/เปิดปิดการมองเห็น/ลบ) เปลี่ยนชื่อแล้วอัพเดททั้งเว็บทันที (การ์ด/ตัวกรอง/
 * แถบหมวดหมู่หน้าแรก ล้วน join จากตาราง categories สดๆ ไม่มีชื่อซ้ำเก็บที่อื่น) — "แถบหมวดหมู่"
 * ในที่นี้คือรายการหมวดหมู่ที่เลื่อนได้บนหน้าแรก คนละอันกับ Carousel แบนเนอร์รูปภาพ (แท็บถัดไป)
 *
 * ลบ — ฐานข้อมูลป้องกันเองด้วย FK (ไม่มี CASCADE) ถ้ายังมีนิยายอ้างอิงอยู่จะลบไม่ได้ (backend คืน
 * CATEGORY_IN_USE ให้ก่อน Postgres จะโยน error ดิบ) แนะนำให้ "ปิดการมองเห็น" แทนถ้าไม่แน่ใจ
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategoryDialog } from './category-dialog'
import { api } from '@/lib/api'
import type { CategoryAdminRow } from '@/types'

export function CategoryTab() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryAdminRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => api.get<{ data: CategoryAdminRow[] }>('/admin/categories').then((res) => res.data),
  })

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] })
  }

  async function handleDelete(row: CategoryAdminRow) {
    if (!window.confirm(`ลบหมวดหมู่ "${row.name}" ใช่หรือไม่?`)) return
    setError(null)
    setBusyId(row.id)
    try {
      await api.delete(`/admin/categories/${row.id}`)
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
          เปลี่ยนชื่อ/ไอคอน/เปิดปิดการมองเห็นแล้วมีผลทันทีทั้งเว็บ — ปิดการมองเห็นเพื่อซ่อนแบบย้อนกลับได้
          แทนการลบ ถ้าไม่แน่ใจ
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
          <p className="text-sm text-muted-foreground">ยังไม่มีหมวดหมู่ — กด &quot;เพิ่ม&quot; เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg">
                {row.icon ?? '📚'}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">{row.name}</span>
                  {!row.status && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">ปิดการมองเห็น</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{row.work_count} เรื่อง</p>
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

      <CategoryDialog
        category={editing}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={refetch}
      />
    </div>
  )
}
