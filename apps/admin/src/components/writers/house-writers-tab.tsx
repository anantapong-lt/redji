'use client'

/**
 * components/writers/house-writers-tab.tsx — แท็บ "เพิ่มนักเขียนของเว็บ" (2026-08-10, ใหม่)
 *
 * ไม่มีหน้า "ผู้ใช้" แบบตั้ง level ได้ทั่วไปในระบบนี้เลย (เข้าใจผิดตอนแรกว่ามี — user เจอเองว่าไม่มี
 * ปุ่มเพิ่มที่ไหนเลย) ปุ่ม "+ เพิ่มนักเขียนของเว็บ" ด้านล่างเปิด modal ค้นหา+ตั้ง level 7 ให้บัญชีไหนก็ได้
 * ตรงๆ (ดู house-writer-promote-modal.tsx) — เลือกบัญชี level 7 ที่มีอยู่แล้วจากลิสต์นี้เพื่อเข้า
 * หน้าตาแบบ /writer/dashboard ของบัญชีนั้น (ผลงานทั้งหมด + ปุ่ม "เพิ่มนิยายใหม่"/"เพิ่มนิยายหลายเรื่อง"
 * ที่นักเขียนทั่วไปไม่มี) กด "แก้ไข" การ์ดไหนก็ redirect ไปหน้า /works/[uuid] เดิม (หน้าแก้ไขผลงานที่มีอยู่แล้ว)
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BookOpen, FolderUp, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { HouseWriterNewWorkModal } from './house-writer-new-work-modal'
import { HouseWriterBulkUploadModal } from './house-writer-bulk-upload-modal'
import { HouseWriterPromoteModal } from './house-writer-promote-modal'
import type { AdminUserRow, Pagination } from '@/types'

interface HouseWriterWorkRow {
  uuid: string
  title: string
  cover_image: string | null
  type: 'novel' | 'manga'
  publish_status: 0 | 1
  completion_status: string | null
  view_count: string
  created_at: string
}

export function HouseWritersTab() {
  const [selected, setSelected] = useState<AdminUserRow | null>(null)

  if (selected) {
    return <HouseWriterDetail writer={selected} onBack={() => setSelected(null)} />
  }
  return <HouseWriterList onSelect={setSelected} />
}

function HouseWriterList({ onSelect }: { onSelect: (u: AdminUserRow) => void }) {
  const [search, setSearch] = useState('')
  const [showPromote, setShowPromote] = useState(false)

  const query = useQuery({
    queryKey: ['admin', 'house-writers', search],
    queryFn: () =>
      api.get<{ data: AdminUserRow[] }>(
        `/admin/users?level=7&limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  })

  const rows = query.data?.data ?? []

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          รายชื่อบัญชี &quot;นักเขียนของเว็บ&quot; (level 7) ทั้งหมด — เลือกบัญชีเพื่ออัพนิยายแทนบัญชีนั้น
        </p>
        <Button className="shrink-0 rounded-full bg-teal-500 text-white hover:bg-teal-600" onClick={() => setShowPromote(true)}>
          <Plus className="size-4" />
          เพิ่มนักเขียนของเว็บ
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ/username..."
          className="h-10 w-full rounded-lg border border-input bg-transparent pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {query.isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {search ? 'ไม่พบบัญชีที่ค้นหา' : 'ยังไม่มีบัญชี "นักเขียนของเว็บ" — กด "เพิ่มนักเขียนของเว็บ" ด้านบนเพื่อตั้งบัญชีแรก'}
          </p>
        ) : (
          rows.map((u) => (
            <button
              key={u.uuid}
              type="button"
              onClick={() => onSelect(u)}
              className="flex w-full cursor-pointer items-center justify-between border-b border-border px-4 py-3 text-left last:border-0 hover:bg-muted"
            >
              <div>
                <div className="text-sm font-medium text-foreground">{u.display_name}</div>
                <div className="text-xs text-muted-foreground">
                  @{u.u_name}
                  {u.creator && ` · สร้างโดย ${u.creator.display_name}`}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{u.email}</span>
            </button>
          ))
        )}
      </div>

      {showPromote && (
        <HouseWriterPromoteModal
          onClose={() => setShowPromote(false)}
          onPromoted={(u) => {
            setShowPromote(false)
            onSelect(u)
          }}
        />
      )}
    </div>
  )
}

function HouseWriterDetail({ writer, onBack }: { writer: AdminUserRow; onBack: () => void }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showNewWork, setShowNewWork] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)

  const queryKey = ['admin', 'house-writer-works', writer.uuid]
  const query = useQuery({
    queryKey,
    queryFn: () =>
      api.get<{ data: HouseWriterWorkRow[]; pagination: Pagination }>(`/admin/users/${writer.uuid}/works?limit=100`),
  })

  const works = query.data?.data ?? []

  function refetchWorks() {
    queryClient.invalidateQueries({ queryKey })
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        กลับไปรายชื่อนักเขียนของเว็บ
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">{writer.display_name}</h2>
          <p className="text-sm text-muted-foreground">
            @{writer.u_name} · {works.length} เรื่อง
            {writer.creator && ` · สร้างโดย ${writer.creator.display_name}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => setShowBulkUpload(true)}>
            <FolderUp className="size-4" />
            เพิ่มนิยายหลายเรื่อง
          </Button>
          <Button className="rounded-full bg-teal-500 text-white hover:bg-teal-600" onClick={() => setShowNewWork(true)}>
            <Plus className="size-4" />
            เพิ่มนิยายใหม่
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : works.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card py-20">
          <BookOpen className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            ยังไม่มีนิยาย — กด &quot;เพิ่มนิยายใหม่&quot; หรือ &quot;เพิ่มนิยายหลายเรื่อง&quot; เพื่อเริ่มต้น
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {works.map((w) => (
            <button
              key={w.uuid}
              type="button"
              onClick={() => router.push(`/works/${w.uuid}`)}
              className="group relative aspect-[2/3] cursor-pointer overflow-hidden rounded-xl bg-muted text-left"
            >
              {w.cover_image ? (
                <img src={w.cover_image} alt={w.title} className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                  ไม่มีรูปปก
                </div>
              )}

              <div className="absolute top-1.5 left-1.5">
                {w.publish_status === 0 && (
                  <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                    ยังไม่เผยแพร่
                  </span>
                )}
              </div>

              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/20 to-transparent p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="line-clamp-4 text-xs font-medium text-white">{w.title}</p>
                <p className="mt-1 text-[11px] text-white/70">กดเพื่อแก้ไข</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {showNewWork && (
        <HouseWriterNewWorkModal
          targetUuid={writer.uuid}
          onClose={() => setShowNewWork(false)}
          onCreated={() => {
            setShowNewWork(false)
            refetchWorks()
          }}
        />
      )}
      {showBulkUpload && (
        <HouseWriterBulkUploadModal
          targetUuid={writer.uuid}
          onClose={() => setShowBulkUpload(false)}
          onUploaded={refetchWorks}
        />
      )}
    </div>
  )
}
