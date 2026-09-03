'use client'

/**
 * components/works/episode-list-table.tsx — แท็บ "รายตอน" ในหน้าแก้ไขผลงาน (2026-08-04, ใหม่)
 *
 * ตัดรูปแบบมาจาก apps/web/src/components/writer/episode-list-table.tsx แต่ตัดเครื่องมือ bulk
 * ออกไปก่อนรอบนี้ (จัดลำดับ/ตั้งราคา-เผยแพร่-คำเรียกตอนหลายตอนพร้อมกัน, "เพิ่มอัตโนมัติ" zip) —
 * เหลือแกนหลักตามที่ user ขอชัดเจน: ดูสถานะเผยแพร่ทุกตอน (รวมตอนที่นักเขียนซ่อนไว้เอง — "Unreach"),
 * สร้าง/แก้ไข/ลบตอน เข้าถึงเนื้อหาเต็มรูปแบบผ่าน EpisodeDialog เดียวกับที่ใช้ทั้งสร้างและแก้
 */

import { useState } from 'react'
import { Plus, Pencil, Trash2, Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EpisodeDialog } from './episode-dialog'
import { TtsAdminRequestDialog } from './tts-admin-request-dialog'
import { api } from '@/lib/api'
import { cn, formatThaiDateTime } from '@/lib/utils'
import { formatEpisodeOrder } from '@/lib/episode-format'
import type { AdminEpisodeRow } from '@/types'

const PUBLISH_LABEL: Record<AdminEpisodeRow['publish_status'], { label: string; className: string }> = {
  now: { label: 'เผยแพร่', className: 'text-teal-600' },
  schedule: { label: 'ตั้งเวลา', className: 'text-amber-600' },
  hide: { label: 'ซ่อน (Unreach)', className: 'text-muted-foreground' },
}

export function EpisodeListTable({
  workUuid,
  episodes,
  isWorkCompleted,
  onRefresh,
}: {
  workUuid: string
  episodes: AdminEpisodeRow[]
  isWorkCompleted: boolean
  onRefresh: () => void
}) {
  const [dialogEpId, setDialogEpId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sorted = [...episodes].sort((a, b) => a.ep_no - b.ep_no)
  const previousEpNo = episodes.length > 0 ? Math.max(...episodes.map((ep) => ep.ep_no)) : null
  const latestEpisodeLabel = sorted.length > 0 ? sorted[sorted.length - 1].episode_label : null

  function openCreate() {
    setDialogEpId(null)
    setDialogOpen(true)
  }

  function openEdit(epId: string) {
    setDialogEpId(epId)
    setDialogOpen(true)
  }

  async function handleDelete(ep: AdminEpisodeRow) {
    if (!window.confirm(`ลบตอน "${ep.ep_name}" ใช่หรือไม่? การกระทำนี้ย้อนกลับไม่ได้`)) return
    setError(null)
    setBusyId(ep.ep_id)
    try {
      await api.delete(`/admin/episodes/${ep.ep_id}`)
      onRefresh()
    } catch (err: any) {
      setError(err?.message ?? 'ลบตอนไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <TtsAdminRequestDialog workUuid={workUuid} episodes={episodes} onCreated={onRefresh} />
        <Button type="button" onClick={openCreate} className="h-10 gap-1.5 rounded-full px-4">
          <Plus className="size-4" />
          เพิ่มตอนนิยายใหม่
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">ลำดับตอน</th>
              <th className="px-4 py-3 font-medium">ชื่อตอน</th>
              <th className="px-4 py-3 text-center font-medium">การเผยแพร่</th>
              <th className="px-4 py-3 font-medium">อัปเดตล่าสุด</th>
              <th className="px-4 py-3 text-center font-medium">ราคา</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((ep) => {
              const status = PUBLISH_LABEL[ep.publish_status]
              return (
                <tr key={ep.ep_id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-foreground">{formatEpisodeOrder(ep.ep_no, ep.episode_label)}</td>
                  <td className="px-4 py-3 text-foreground">{ep.ep_name}</td>
                  <td className={cn('px-4 py-3 text-center font-medium', status.className)}>{status.label}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatThaiDateTime(ep.updated_at)}</td>
                  <td className="px-4 py-3 text-center font-medium">
                    {ep.is_free ? (
                      <span className="text-teal-600">อ่านฟรี</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <Coins className="size-3.5" />
                        {Number(ep.ep_price)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(ep.ep_id)}
                        className="flex cursor-pointer items-center gap-1 text-primary hover:underline"
                      >
                        <Pencil className="size-3.5" />
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        disabled={busyId === ep.ep_id}
                        onClick={() => handleDelete(ep)}
                        className="flex cursor-pointer items-center gap-1 text-destructive hover:underline disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" />
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  ยังไม่มีตอน — กด &ldquo;เพิ่มตอนนิยายใหม่&rdquo; เพื่อเริ่มต้น
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        จำนวนตอนทั้งหมด <span className="font-medium text-foreground">{episodes.length}</span> ตอน
      </p>

      <EpisodeDialog
        workUuid={workUuid}
        epId={dialogEpId}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        previousEpNo={previousEpNo}
        totalEpisodes={episodes.length}
        isWorkCompleted={isWorkCompleted}
        existingEpNos={episodes.filter((ep) => ep.ep_id !== dialogEpId).map((ep) => ep.ep_no)}
        latestEpisodeLabel={latestEpisodeLabel}
        onSaved={onRefresh}
      />
    </div>
  )
}
