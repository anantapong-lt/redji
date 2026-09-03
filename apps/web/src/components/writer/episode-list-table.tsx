'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  RefreshCw,
  Clock,
  Coins,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  Plus,
  Pencil,
  ExternalLink,
  Rows3,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  Settings2,
  Volume2,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CreateEpisodeDialog } from './create-episode-dialog'
import { EditEpisodeDialog } from './edit-episode-dialog'
import { ReorderEpisodesDialog } from './reorder-episodes-dialog'
import { EpisodeLabelSettingsDialog } from './episode-label-settings-dialog'
import { EpisodePublishSettingsDialog } from './episode-publish-settings-dialog'
import { EpisodePriceSettingsDialog } from './episode-price-settings-dialog'
import { TtsRequestDialog } from './tts-request-dialog'
import { cn, formatThaiDateTime } from '@/lib/utils'
import { formatEpisodeOrder } from '@/lib/episode-format'

// รูปทรงตรงกับ GET /writer/works/:uuid/episodes จริง (ดู getMyEpisodes ใน writer.service.ts)
// ยกเว้น view_count/comment_count/sales_total ที่ backend ยังไม่ return (ดู KNOWN_ISSUES.md)
export interface WriterEpisodeRow {
  ep_id: string
  ep_name: string
  ep_no: number
  ep_price: string
  is_free: boolean
  publish_status: 'now' | 'schedule' | 'hide'
  episode_label: string | null // migration 014: ค่าต่อตอน
  updated_at: string
  tts_tier: 'basic' | 'pro' | null
}

const PUBLISH_LABEL: Record<WriterEpisodeRow['publish_status'], { label: string; className: string }> = {
  now: { label: 'เผยแพร่', className: 'text-teal-600' },
  schedule: { label: 'ตั้งเวลา', className: 'text-amber-600' },
  hide: { label: 'ซ่อน', className: 'text-muted-foreground' },
}

const PAGE_SIZE_OPTIONS = [50, 100, 200]
const MAX_PAGE_BUTTONS = 6

export function EpisodeListTable({
  workUuid,
  episodes,
  isWorkCompleted,
  isNovel,
  onDeleteMany,
  onRefresh,
  onEpisodeCreated,
}: {
  workUuid: string
  episodes: WriterEpisodeRow[]
  isWorkCompleted: boolean
  isNovel: boolean
  onDeleteMany: (epIds: string[]) => void | Promise<void>
  onRefresh: () => void
  onEpisodeCreated: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pageSize, setPageSize] = useState(50)
  const [ascending, setAscending] = useState(true)
  const [page, setPage] = useState(1)
  const [editingEpId, setEditingEpId] = useState<string | null>(null)

  const sorted = useMemo(() => {
    const list = [...episodes].sort((a, b) => a.ep_no - b.ep_no)
    return ascending ? list : list.reverse()
  }, [episodes, ascending])

  const previousEpNo = episodes.length > 0 ? Math.max(...episodes.map((ep) => ep.ep_no)) : null
  // migration 014 — คำเรียกของตอนล่าสุด เอามาเติมให้อัตโนมัติตอนสร้างตอนใหม่ (ตรงกับที่ backend
  // inherit ให้เองอยู่แล้วถ้าไม่ส่ง episode_label มา — ดู createEpisode() ใน writer.service.ts)
  const latestEpisodeLabel = sorted.length > 0 ? sorted[sorted.length - 1].episode_label : null

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageItems = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const allOnPageSelected = pageItems.length > 0 && pageItems.every((ep) => selected.has(ep.ep_id))

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) {
        pageItems.forEach((ep) => next.delete(ep.ep_id))
      } else {
        pageItems.forEach((ep) => next.add(ep.ep_id))
      }
      return next
    })
  }

  function toggleOne(epId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(epId)) next.delete(epId)
      else next.add(epId)
      return next
    })
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!window.confirm(`ลบ ${selected.size} ตอนที่เลือกไว้? การกระทำนี้ย้อนกลับไม่ได้`)) return
    await onDeleteMany([...selected])
    setSelected(new Set())
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            setPageSize(Number(v))
            setPage(1)
          }}
        >
          <SelectTrigger className="h-9 w-40">
            <Rows3 className="size-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                แสดง {n} รายการ
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={ascending ? 'asc' : 'desc'} onValueChange={(v) => setAscending(v === 'asc')}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">
              <ArrowUpNarrowWide className="size-4" />
              น้อยไปมาก
            </SelectItem>
            <SelectItem value="desc">
              <ArrowDownWideNarrow className="size-4" />
              มากไปน้อย
            </SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onRefresh}
            aria-label="รีเฟรช"
            title="รีเฟรช"
            className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
          >
            <RefreshCw className="size-4" />
          </button>
          <EpisodePublishSettingsDialog
            workUuid={workUuid}
            latestEpNo={previousEpNo}
            selectedEpIds={[...selected]}
            onUpdated={onEpisodeCreated}
            onClearSelection={() => setSelected(new Set())}
            trigger={
              <button
                type="button"
                aria-label="ตั้งเวลาเผยแพร่หลายตอน"
                title="ตั้งเวลาเผยแพร่หลายตอน"
                className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
              >
                <Clock className="size-4" />
              </button>
            }
          />
          <EpisodePriceSettingsDialog
            workUuid={workUuid}
            selectedEpIds={[...selected]}
            onUpdated={onEpisodeCreated}
            onClearSelection={() => setSelected(new Set())}
            trigger={
              <button
                type="button"
                aria-label="ตั้งราคาหลายตอน"
                title="ตั้งราคาหลายตอน"
                className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
              >
                <Coins className="size-4" />
              </button>
            }
          />
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={selected.size === 0}
            aria-label="ลบตอนที่เลือก"
            title="ลบตอนที่เลือก"
            className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="size-4" />
          </button>
          <EpisodeLabelSettingsDialog
            workUuid={workUuid}
            latestEpNo={previousEpNo}
            selectedEpIds={[...selected]}
            onUpdated={onEpisodeCreated}
            onClearSelection={() => setSelected(new Set())}
            trigger={
              <button
                type="button"
                aria-label="ตั้งค่าพิเศษ"
                title="ตั้งค่าพิเศษ"
                className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
              >
                <Settings2 className="size-4" />
              </button>
            }
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isNovel && (
            <TtsRequestDialog
              workUuid={workUuid}
              episodes={episodes}
              selectedEpisodeIds={[...selected]}
              onSubmitted={onRefresh}
              trigger={
                <Button type="button" variant="outline" className="h-10 gap-1.5 rounded-full border-amber-500/60 px-4 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30">
                  <Volume2 className="size-4" />
                  ขอเสียงบรรยาย
                </Button>
              }
            />
          )}
          <ReorderEpisodesDialog
            episodes={episodes}
            onReordered={onEpisodeCreated}
            trigger={
              <Button type="button" variant="outline" className="h-10 gap-1.5 rounded-full border-primary px-4 text-primary">
                <ListOrdered className="size-4" />
                จัดลำดับตอน
              </Button>
            }
          />
          <CreateEpisodeDialog
            workUuid={workUuid}
            previousEpNo={previousEpNo}
            totalEpisodes={episodes.length}
            isWorkCompleted={isWorkCompleted}
            existingEpNos={episodes.map((ep) => ep.ep_no)}
            latestEpisodeLabel={latestEpisodeLabel}
            onCreated={onEpisodeCreated}
            trigger={
              <Button type="button" className="h-10 gap-1.5 rounded-full px-4">
                <Plus className="size-4" />
                เพิ่มตอนนิยายใหม่
              </Button>
            }
          />
        </div>
      </div>

      <EditEpisodeDialog
        epId={editingEpId}
        open={editingEpId !== null}
        onOpenChange={(v) => !v && setEditingEpId(null)}
        existingEpNos={episodes.filter((ep) => ep.ep_id !== editingEpId).map((ep) => ep.ep_no)}
        onUpdated={onEpisodeCreated}
      />

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="w-10 px-4 py-3">
                <Checkbox checked={allOnPageSelected} onCheckedChange={toggleAll} aria-label="เลือกทั้งหมด" />
              </th>
              <th className="px-4 py-3 font-medium">ลำดับตอน</th>
              <th className="px-4 py-3 font-medium">ชื่อตอน</th>
              <th className="px-4 py-3 text-center font-medium">ยอดวิว</th>
              <th className="px-4 py-3 text-center font-medium">ยอดคอมเมนต์</th>
              <th className="px-4 py-3 text-center font-medium">ยอดขายรวม</th>
              <th className="px-4 py-3 text-center font-medium">การเผยแพร่</th>
              <th className="px-4 py-3 font-medium">อัปเดตล่าสุด</th>
              <th className="px-4 py-3 text-center font-medium">กำหนดราคาต่อ</th>
              {isNovel && <th className="px-4 py-3 text-center font-medium">เสียงบรรยาย</th>}
              <th className="px-4 py-3 font-medium">แก้ไข</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {pageItems.map((ep) => {
              const status = PUBLISH_LABEL[ep.publish_status]
              return (
                <tr key={ep.ep_id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selected.has(ep.ep_id)}
                      onCheckedChange={() => toggleOne(ep.ep_id)}
                      aria-label={`เลือกตอนที่ ${ep.ep_no}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-foreground">{formatEpisodeOrder(ep.ep_no, ep.episode_label)}</td>
                  <td className="px-4 py-3 text-foreground">{ep.ep_name}</td>
                  {/* ยอดวิว/คอมเมนต์/ขาย — backend ยังไม่ return (ดู KNOWN_ISSUES.md) */}
                  <td className="px-4 py-3 text-center text-muted-foreground">-</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">-</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">-</td>
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
                  {isNovel && (
                    <td className="px-4 py-3 text-center">
                      {ep.tts_tier === 'basic' ? (
                        <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">TTS ธรรมดา</span>
                      ) : ep.tts_tier === 'pro' ? (
                        <span className="inline-flex rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">TTS Pro</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setEditingEpId(ep.ep_id)}
                      className="flex cursor-pointer items-center gap-1 text-primary hover:underline"
                    >
                      <Pencil className="size-3.5" />
                      แก้ไข
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/works/${workUuid}/read/${ep.ep_no}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="ไปหน้าอ่าน"
                      title="ไปหน้าอ่าน"
                      className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <ExternalLink className="size-4" />
                    </Link>
                  </td>
                </tr>
              )
            })}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={isNovel ? 12 : 11} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  ยังไม่มีตอน — กด &ldquo;เพิ่มตอนนิยายใหม่&rdquo; เพื่อเริ่มต้น
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted-foreground">
          จำนวนตอนทั้งหมด <span className="font-medium text-foreground">{episodes.length}</span> ตอน
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
            ก่อนหน้า
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(0, MAX_PAGE_BUTTONS)
            .map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={cn(
                  'flex size-9 cursor-pointer items-center justify-center rounded-lg border text-sm',
                  p === currentPage ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
                )}
              >
                {p}
              </button>
            ))}
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            ต่อไป
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
