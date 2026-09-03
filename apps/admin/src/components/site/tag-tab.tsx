'use client'

/**
 * components/site/tag-tab.tsx — แท็บ "หมวดหมู่ย่อย" (2026-08-17, ใหม่)
 *
 * เดิม tag (works.tags, free-text ที่นักเขียนพิมพ์เอง) ไม่มีหน้าแอดมินจัดการเลย แก้ได้แค่ทีละเรื่อง
 * ผ่านฟอร์มแก้ไขผลงาน — หน้านี้โชว์ภาพรวมทั้งหมด เรียงจากที่ใช้เยอะสุดไปน้อยสุด พร้อมวันที่ใช้ล่าสุด
 * และสถานะ (ใช้งานอยู่ / ไม่มีใครใช้แล้ว — แถวหลังนี้เกิดได้เพราะระบบ cleanup อัตโนมัติของ tag
 * registry ทำงานแยกจาก works.tags จริง เผื่อมีช่วงที่ tag ค้างในระบบทั้งที่ไม่มีเรื่องไหนใช้แล้ว)
 *
 * กด "ดูรายชื่อเรื่อง" ขยายแถวโชว์ว่าเรื่องไหนใส่ tag นี้บ้าง พร้อมปุ่ม "ถอด" ถอดออกจากเรื่องนั้น
 * เรื่องเดียว — ปุ่ม "ลบถาวร" ที่หัวแถวลบออกจากทุกเรื่องพร้อมกันในทีเดียว (ย้อนกลับไม่ได้)
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatThaiDateTime } from '@/lib/utils'
import type { TagAdminRow, TagWorkRow, Pagination } from '@/types'

function TagWorksList({ tagId, tagName, onChanged }: { tagId: string; tagName: string; onChanged: () => void }) {
  const queryClient = useQueryClient()
  const [busyPId, setBusyPId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'tag-works', tagId],
    queryFn: () => api.get<{ data: TagWorkRow[] }>(`/admin/tags/${tagId}/works`).then((res) => res.data),
  })

  async function handleDetach(work: TagWorkRow) {
    if (!window.confirm(`ถอดหมวดหมู่ย่อย "${tagName}" ออกจาก "${work.title}" ใช่หรือไม่?`)) return
    setError(null)
    setBusyPId(work.p_id)
    try {
      await api.delete(`/admin/tags/${tagId}/works/${work.p_id}`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'tag-works', tagId] })
      onChanged()
    } catch (err: any) {
      setError(err?.message ?? 'ถอดไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusyPId(null)
    }
  }

  const works = query.data ?? []

  return (
    <div className="border-t border-border bg-muted/30 px-4 py-3">
      {error && (
        <p className="mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}
      {query.isLoading ? (
        <p className="py-3 text-center text-xs text-muted-foreground">กำลังโหลด...</p>
      ) : works.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">ไม่มีเรื่องไหนใส่หมวดหมู่ย่อยนี้แล้ว</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {works.map((w) => (
            <div key={w.p_id} className="flex items-center gap-3 rounded-lg bg-card px-3 py-2">
              <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                {w.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.cover_image} alt="" className="size-full object-cover" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">ไม่มีรูป</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-foreground">{w.title}</span>
                  {!w.is_published && (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">ยังไม่เผยแพร่</span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">โดย {w.author_name}</p>
              </div>
              <button
                type="button"
                disabled={busyPId === w.p_id}
                onClick={() => handleDetach(w)}
                className="shrink-0 cursor-pointer text-xs text-destructive hover:underline disabled:opacity-50"
              >
                ถอด
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function TagTab() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'tags', page],
    queryFn: () => api.get<{ data: TagAdminRow[]; pagination: Pagination }>(`/admin/tags?page=${page}&limit=50`),
  })

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'tags'] })
  }

  async function handleDeletePermanent(tag: TagAdminRow) {
    const warning =
      tag.work_count > 0
        ? `ลบหมวดหมู่ย่อย "${tag.name}" ออกจาก ${tag.work_count} เรื่องถาวร ย้อนกลับไม่ได้ ยืนยันหรือไม่?`
        : `ลบหมวดหมู่ย่อย "${tag.name}" ทิ้งถาวร (ไม่มีเรื่องไหนใช้อยู่แล้ว) ยืนยันหรือไม่?`
    if (!window.confirm(warning)) return
    setError(null)
    setBusyId(tag.id)
    try {
      await api.delete(`/admin/tags/${tag.id}`)
      if (expandedId === tag.id) setExpandedId(null)
      refetch()
    } catch (err: any) {
      setError(err?.message ?? 'ลบไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusyId(null)
    }
  }

  const rows = query.data?.data ?? []
  const pagination = query.data?.pagination

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        หมวดหมู่ย่อย (tag) ทั้งหมดที่นักเขียนเคยพิมพ์ใส่ผลงาน เรียงจากที่ใช้เยอะสุดไปน้อยสุด — ลบทิ้งถาวรจะ
        ถอดออกจากทุกเรื่องที่ใส่อยู่ทันที ย้อนกลับไม่ได้
      </p>

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {query.isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">ยังไม่มีหมวดหมู่ย่อยในระบบ</p>
        ) : (
          rows.map((tag) => (
            <div key={tag.id} className="border-b border-border last:border-0">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{tag.name}</span>
                    <span
                      className={
                        tag.status === 'active'
                          ? 'shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground'
                      }
                    >
                      {tag.status === 'active' ? 'ใช้งานอยู่' : 'ไม่มีใครใช้แล้ว'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ใช้อยู่ {tag.work_count} เรื่อง
                    {tag.last_used_at && ` · ใช้ล่าสุด ${formatThaiDateTime(tag.last_used_at)}`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === tag.id ? null : tag.id)}
                  className="flex shrink-0 cursor-pointer items-center gap-1 text-sm text-primary hover:underline"
                >
                  {expandedId === tag.id ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  ดูรายชื่อเรื่อง
                </button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={busyId === tag.id}
                  onClick={() => handleDeletePermanent(tag)}
                  className="h-8 shrink-0 gap-1 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" />
                  ลบถาวร
                </Button>
              </div>

              {expandedId === tag.id && <TagWorksList tagId={tag.id} tagName={tag.name} onChanged={refetch} />}
            </div>
          ))
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-8 px-3 text-xs">
            ก่อนหน้า
          </Button>
          <span className="text-xs text-muted-foreground">
            {pagination.page} / {pagination.pages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
            className="h-8 px-3 text-xs"
          >
            ถัดไป
          </Button>
        </div>
      )}
    </div>
  )
}
