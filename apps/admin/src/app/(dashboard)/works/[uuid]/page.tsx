'use client'

/**
 * app/(dashboard)/works/[uuid]/page.tsx — หน้าแก้ไขผลงาน (2026-08-04, ใหม่)
 *
 * user ขอให้ "เหมือนกับ Writer เลย" — พอร์ตหน้าตา/ฟิลด์มาจาก
 * apps/web/src/app/(writer)/writer/works/[uuid]/page.tsx ตรงๆ ทุก field (คัด component ที่ใช้
 * Radix มาเขียนใหม่แบบ hand-rolled ให้ตรงกับแนวทางเดิมของ apps/admin เท่านั้น — ui/logic เดิมหมด)
 * ต่างจากฝั่ง writer อยู่ 2 จุด:
 *   1. แถบ "โหมด Admin Edit" สีม่วงคาดบนสุด (ตามที่ user ขอ) บอกว่ากำลังแก้ผลงานของนักเขียนคนไหน
 *   2. ยิง /admin/works/:uuid (ไม่ใช่ /writer/works/:uuid) — แก้ผลงานใครก็ได้ ไม่ใช่แค่ของตัวเอง
 *      (ดู admin-works.service.ts ฝั่ง backend — delegate ไปที่ writer.service.ts โดยสวม author_id
 *      ของเจ้าของจริง ได้สิทธิ์เท่ากับนักเขียนคนนั้นแก้เองทุกอย่าง รวมเผยแพร่/ไม่เผยแพร่แม้เรื่องที่
 *      นักเขียนปิดไว้เอง)
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, ExternalLink, ShieldAlert, MessageSquareWarning, Trash2, AlertOctagon } from 'lucide-react'
import type { JSONContent } from '@tiptap/react'
import { formatThaiDateTime, cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { SITE_CONFIG } from '@/site.config'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Modal } from '@/components/ui/modal'
import { EditableCover } from '@/components/works/editable-cover'
import { SearchableSelect } from '@/components/works/searchable-select'
import { TagInput } from '@/components/works/tag-input'
import { RichTextEditor } from '@/components/works/rich-text-editor'
import { EpisodeListTable } from '@/components/works/episode-list-table'
import { WorkAnalyticsTab } from '@/components/works/work-analytics-tab'
import { useAdminUser } from '@/store/auth.store'
import type { AdminWorkDetail, AdminEpisodeRow, CategoryRef } from '@/types'

const TABS = [
  { key: 'detail', label: 'รายละเอียด' },
  { key: 'episodes', label: 'รายตอน' },
  { key: 'analytics', label: 'สถิติเจาะลึก' },
] as const
type TabKey = (typeof TABS)[number]['key']

const INPUT_CLASS =
  'h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export default function AdminEditWorkPage() {
  const me = useAdminUser()
  const myLevel = me?.level ?? 0
  const { uuid } = useParams<{ uuid: string }>()

  if (myLevel < 9) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">ผลงาน</h1>
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          ต้องเป็นแอดมินรองขึ้นไป (level ≥ 9) ถึงจะเข้าดูแท็บนี้ได้
        </p>
      </div>
    )
  }

  // key={uuid} บังคับ React unmount+remount ทั้งก้อนทุกครั้งที่ uuid เปลี่ยน (2026-08-05, บั๊กจริงที่
  // user เจอ: เปิดผลงานของ testuser007 แต่ข้อมูลที่โชว์กลับเป็นของ devtest) — Next.js App Router
  // ไม่ remount component เองเวลาแค่ dynamic segment เปลี่ยน (คนละ route "รูปร่าง" เดิม) ทำให้ state
  // ในตัว (tab ที่เลือกไว้, title/category ที่พิมพ์ค้างไว้ ฯลฯ) จากผลงานเก่าอาจค้างโผล่มาปนกับ
  // ผลงานใหม่ชั่วครู่ระหว่างที่ query ตัวใหม่ยังโหลดไม่เสร็จ — ใส่ key ให้ตรงไปตรงมาที่สุด แก้ได้
  // ทั้งก้อนไม่ต้องไล่เช็คทีละ state
  return <EditWorkContent key={uuid} />
}

function EditWorkContent() {
  const { uuid } = useParams<{ uuid: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const me = useAdminUser()
  const myLevel = me?.level ?? 0
  const [tab, setTab] = useState<TabKey>('detail')
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading, isError, refetch: refetchWork } = useQuery({
    queryKey: ['admin', 'work', uuid],
    queryFn: () => api.get<{ data: AdminWorkDetail }>(`/admin/works/${uuid}`).then((res) => res.data),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ data: { id: string; name: string }[] }>('/categories').then((res) => res.data),
  })
  const categories: CategoryRef[] = (categoriesData ?? []).map((c) => ({ id: Number(c.id), name: c.name }))

  const {
    data: episodes,
    isLoading: episodesLoading,
    isError: episodesError,
    refetch: refetchEpisodes,
  } = useQuery({
    queryKey: ['admin', 'work', uuid, 'episodes'],
    queryFn: () => api.get<{ data: AdminEpisodeRow[] }>(`/admin/works/${uuid}/episodes`).then((res) => res.data),
    enabled: tab === 'episodes',
  })

  const [title, setTitle] = useState('')
  const [originalTitle, setOriginalTitle] = useState('')
  const [categoryMain, setCategoryMain] = useState<CategoryRef | null>(null)
  const [categorySub, setCategorySub] = useState<CategoryRef | null>(null)
  const [novelType, setNovelType] = useState('original')
  const [publishLevel, setPublishLevel] = useState('draft')
  const [isCompleted, setIsCompleted] = useState(false)
  const [is18Plus, setIs18Plus] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [blurb, setBlurb] = useState('')
  const [synopsis, setSynopsis] = useState<JSONContent | undefined>(undefined)
  const [cover, setCover] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  // "ส่งรายงานถึงนักเขียน" (writer_admin_notices, migration 032) — คนละเรื่องกับรายงานจากนักอ่าน
  // (content_reports) ส่งจากหน้านี้ตรงๆ เพราะกำลังดูผลงานเรื่องนี้อยู่แล้ว (user ขอไว้แบบนี้ ไม่ต้อง
  // มีฟอร์มแยกอยู่หน้ารายงาน) นักเขียนเห็นในแท็บ "รายงานจากแอดมิน" ของหน้า /writer/reports
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [noticeMessage, setNoticeMessage] = useState('')
  const [noticeSending, setNoticeSending] = useState(false)
  const [noticeError, setNoticeError] = useState<string | null>(null)

  // ลบผลงาน (2026-08-10, ใหม่) — "ลบ" (soft) กับ "ลบถาวร" (hard, level 10 เท่านั้น) แยกกันชัดเจน
  // ลบถาวรต้องพิมพ์ชื่อเรื่องซ้ำให้ตรงเป๊ะก่อนถึงจะกดยืนยันได้ กันกดพลาด (ย้อนคืนไม่ได้จริงๆ)
  const [deleting, setDeleting] = useState(false)
  const [permaDeleteOpen, setPermaDeleteOpen] = useState(false)
  const [permaConfirmText, setPermaConfirmText] = useState('')
  const [permaDeleting, setPermaDeleting] = useState(false)
  const [permaError, setPermaError] = useState<string | null>(null)

  async function handleSoftDelete() {
    if (!data) return
    if (!confirm(`ลบผลงาน "${data.title}" ใช่ไหม?\n\nงานนี้จะหายไปจากทุกที่ (รวมถึงหน้าของนักเขียนเจ้าของเอง) แต่ข้อมูลยังอยู่ในระบบ กู้คืนได้ทีหลังถ้าจำเป็น`)) return

    setDeleting(true)
    try {
      await api.delete(`/admin/works/${uuid}`)
      // ต้องสั่ง invalidate เองก่อน push — ไม่งั้นหน้า /works ที่ redirect ไปจะยังโชว์ลิสต์เก่าค้างอยู่
      // ถ้า query เดิม fetch มาไม่เกิน staleTime (30s) เพราะ react-query คิดว่า cache ยังสดอยู่
      // (2026-08-11 user เจอเอง — ทุก action ในแอดมินที่ลืม invalidate จะเป็นแบบนี้หมด)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'works-gallery'] })
      router.push('/works')
    } catch (err: any) {
      setError(err?.message ?? 'ลบไม่สำเร็จ ลองใหม่อีกครั้ง')
      setDeleting(false)
    }
  }

  async function handlePermaDelete() {
    if (!data || permaConfirmText !== data.title) return
    setPermaDeleting(true)
    setPermaError(null)
    try {
      await api.delete(`/admin/works/${uuid}/permanent`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'works-gallery'] })
      router.push('/works')
    } catch (err: any) {
      setPermaError(err?.message ?? 'ลบถาวรไม่สำเร็จ ลองใหม่อีกครั้ง')
      setPermaDeleting(false)
    }
  }

  useEffect(() => {
    if (!data) return
    setTitle(data.title)
    setOriginalTitle(data.original_title ?? '')
    setCategoryMain(data.category_main ? { id: Number(data.category_main.id), name: data.category_main.name } : null)
    setCategorySub(data.category_sub ? { id: Number(data.category_sub.id), name: data.category_sub.name } : null)
    setNovelType(data.is_translated ? 'translated' : 'original')
    setPublishLevel(data.publish_status === 1 ? 'published' : 'draft')
    setIsCompleted(data.completion_status === 'completed')
    setIs18Plus(data.age_rate === '18+')
    setTags(data.tags ?? [])
    setBlurb(data.description ?? '')
    setSynopsis(data.synopsis ?? undefined)
  }, [data])

  async function handleSave() {
    if (!title.trim()) {
      setError('กรุณากรอกชื่อเรื่องก่อนบันทึก')
      return
    }

    setError(null)
    setSaving(true)
    try {
      await api.patch(`/admin/works/${uuid}`, {
        title: title.trim(),
        original_title: originalTitle.trim() || null,
        description: blurb.trim() || null,
        synopsis: synopsis ?? null,
        category_main: categoryMain?.id ?? null,
        category_sub: categorySub?.id ?? null,
        age_rate: is18Plus ? '18+' : 'all',
        is_translated: novelType === 'translated',
        tags,
        completion_status: isCompleted ? 'completed' : 'ongoing',
        publish_status: publishLevel === 'published' ? 1 : 0,
      })

      if (cover) {
        const formData = new FormData()
        formData.append('cover', cover)
        await api.post(`/admin/works/${uuid}/cover`, formData)
      }

      await queryClient.invalidateQueries({ queryKey: ['admin', 'work', uuid] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'works-gallery'] })
    } catch (err: any) {
      setError(err?.message ?? 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  async function handleSendNotice() {
    if (!noticeMessage.trim()) return
    setNoticeSending(true)
    setNoticeError(null)
    try {
      await api.post(`/admin/works/${uuid}/notice`, { message: noticeMessage.trim() })
      setNoticeOpen(false)
      setNoticeMessage('')
    } catch (err: any) {
      setNoticeError(err?.message ?? 'ส่งรายงานไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setNoticeSending(false)
    }
  }

  return (
    <div>
      {/* แถบ "โหมด Admin Edit" — user ขอให้คาดตัวใหญ่ๆ ด้านบนสุด สีม่วง แยกให้ชัดจากหน้าปกติ */}
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-white shadow-sm">
        <ShieldAlert className="size-5 shrink-0" />
        <span className="text-base font-bold">โหมด Admin Edit</span>
        {data && (
          <span className="text-sm text-purple-100">
            — กำลังแก้ไขผลงานของ {data.author.display_name} (@{data.author.u_name}) โดยตรง
          </span>
        )}
      </div>

      <h1 className="mb-1 text-2xl font-bold text-foreground">นิยาย</h1>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Link href="/works" className="hover:text-foreground">
            ผลงาน
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">{data?.title ?? 'กำลังโหลด...'}</span>
        </div>
        {data && (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setNoticeOpen(true)}
              className="flex cursor-pointer items-center gap-1.5 text-primary hover:underline"
            >
              <MessageSquareWarning className="size-3.5" />
              ส่งรายงานถึงนักเขียน
            </button>
            <a
              href={`${SITE_CONFIG.webUrl}/works/${uuid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex cursor-pointer items-center gap-1.5 text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" />
              ดูหน้านิยายจริง
            </a>
            {data.status === 'active' && (
              <button
                type="button"
                onClick={handleSoftDelete}
                disabled={deleting}
                className="flex cursor-pointer items-center gap-1.5 text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                {deleting ? 'กำลังลบ...' : 'ลบ'}
              </button>
            )}
            {myLevel >= 10 && (
              <button
                type="button"
                onClick={() => {
                  setPermaConfirmText('')
                  setPermaError(null)
                  setPermaDeleteOpen(true)
                }}
                className="flex cursor-pointer items-center gap-1.5 text-destructive hover:underline"
              >
                <AlertOctagon className="size-3.5" />
                ลบถาวร
              </button>
            )}
          </div>
        )}
      </div>

      {data && data.status === 'deleted' && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
          <Trash2 className="size-4 shrink-0" />
          ผลงานเรื่องนี้ถูกลบไปแล้ว (soft delete) — ไม่แสดงในหน้าเว็บหรือหน้าของนักเขียนเจ้าของเองแล้ว
        </div>
      )}

      <Modal
        open={noticeOpen}
        onClose={() => {
          if (noticeSending) return
          setNoticeOpen(false)
          setNoticeMessage('')
          setNoticeError(null)
        }}
        title={`ส่งรายงานถึง ${data?.author.display_name ?? ''}`}
      >
        <p className="mb-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          ข้อความนี้จะไปโผล่ในแท็บ &quot;รายงานจากแอดมิน&quot; ของนักเขียนเจ้าของผลงานเรื่อง &quot;{data?.title}&quot;
          โดยตรง (คนละเรื่องกับรายงานจากนักอ่าน)
        </p>
        {noticeError && (
          <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {noticeError}
          </p>
        )}
        <label className="mb-1.5 block text-sm font-medium text-foreground">ข้อความ</label>
        <textarea
          value={noticeMessage}
          onChange={(e) => setNoticeMessage(e.target.value)}
          rows={4}
          autoFocus
          maxLength={1000}
          className="mb-4 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="ระบุรายละเอียด..."
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setNoticeOpen(false)} disabled={noticeSending}>
            ยกเลิก
          </Button>
          <Button disabled={noticeSending || !noticeMessage.trim()} onClick={handleSendNotice}>
            {noticeSending ? 'กำลังส่ง...' : 'ส่งรายงาน'}
          </Button>
        </div>
      </Modal>

      <Modal
        open={permaDeleteOpen}
        onClose={() => {
          if (permaDeleting) return
          setPermaDeleteOpen(false)
        }}
        title="ลบผลงานถาวร"
      >
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          การลบนิยายวิธีนี้คือการลบออกจากสารระบบทั้งหมดและไม่ควรเกิดขึ้นหากต้องการลบแบบแค่ไม่ให้ใครเห็น
          ไปใช้ &quot;ลบ&quot; (soft delete) แทน เพราะการกระทำต่อไปนี้จะย้อนคืนไม่ได้
        </div>

        {permaError && (
          <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {permaError}
          </p>
        )}

        <label className="mb-1.5 block text-sm font-medium text-foreground">
          พิมพ์ชื่อเรื่อง &quot;{data?.title}&quot; ให้ตรงเป๊ะเพื่อยืนยัน
        </label>
        <input
          value={permaConfirmText}
          onChange={(e) => setPermaConfirmText(e.target.value)}
          autoFocus
          className="mb-4 h-10 w-full rounded-lg border border-destructive/40 bg-transparent px-3 text-sm outline-none focus-visible:border-destructive focus-visible:ring-3 focus-visible:ring-destructive/30"
        />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPermaDeleteOpen(false)} disabled={permaDeleting}>
            ยกเลิก
          </Button>
          <Button
            variant="destructive"
            disabled={permaDeleting || permaConfirmText !== data?.title}
            onClick={handlePermaDelete}
          >
            {permaDeleting ? 'กำลังลบถาวร...' : 'ลบถาวร ย้อนคืนไม่ได้'}
          </Button>
        </div>
      </Modal>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex gap-2.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'cursor-pointer rounded-t-[15px] px-5 py-2.5 text-sm font-medium transition-colors',
                tab === t.key
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-b-0 border-border bg-background text-foreground hover:bg-muted',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {data && (
          <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground sm:flex-row sm:gap-4">
            <span>วันที่พิมพ์: {formatThaiDateTime(data.created_at)}</span>
            <span>วันที่แก้ไข: {formatThaiDateTime(data.updated_at)}</span>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-6">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : isError || !data ? (
          <p className="py-8 text-center text-sm text-destructive">โหลดข้อมูลไม่สำเร็จ — อาจไม่พบผลงานเรื่องนี้</p>
        ) : tab === 'detail' ? (
          <div className="flex flex-col gap-6">
            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
              <EditableCover src={data.cover_image} onChange={setCover} />

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">ชื่อเรื่อง</label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">ชื่อเรื่องต้นฉบับ</label>
                    <input
                      value={originalTitle}
                      onChange={(e) => setOriginalTitle(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-4">
                  <div className="w-36">
                    <label className="mb-1.5 block text-sm font-medium text-foreground">หมวดหมู่หลัก</label>
                    <SearchableSelect options={categories} value={categoryMain} onChange={setCategoryMain} />
                  </div>
                  <div className="w-36">
                    <label className="mb-1.5 block text-sm font-medium text-foreground">หมวดหมู่รอง</label>
                    <SearchableSelect options={categories} value={categorySub} onChange={setCategorySub} />
                  </div>
                  <div className="w-36">
                    <label className="mb-1.5 block text-sm font-medium text-foreground">ประเภทนิยาย</label>
                    <Select value={novelType} onChange={(e) => setNovelType(e.target.value)}>
                      <option value="translated">นิยายแปล</option>
                      <option value="original">แต่งเอง</option>
                    </Select>
                  </div>
                  <div className="w-40">
                    <label className="mb-1.5 block text-sm font-medium text-foreground">ระดับการเผยแพร่</label>
                    <Select value={publishLevel} onChange={(e) => setPublishLevel(e.target.value)}>
                      <option value="draft">ยังไม่เผยแพร่</option>
                      <option value="published">เผยแพร่แล้ว</option>
                      <option value="scheduled">ตั้งเวลาเผยแพร่</option>
                    </Select>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 pb-1.5">
                    <Switch checked={isCompleted} onCheckedChange={setIsCompleted} />
                    <span className="text-sm text-foreground">จบ</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 pb-1.5">
                    <Switch checked={is18Plus} onCheckedChange={setIs18Plus} />
                    <span className="text-sm font-semibold text-pink-600">18+</span>
                  </label>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">หมวดหมู่เสริม</label>
                  <TagInput tags={tags} onChange={setTags} />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">คำโปรย</label>
                  <textarea
                    value={blurb}
                    onChange={(e) => setBlurb(e.target.value)}
                    rows={3}
                    className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">แนะนำเรื่อง/เรื่องย่อ/พรรณนา</label>
              <RichTextEditor content={synopsis} onChange={setSynopsis} />
            </div>

            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                className="rounded-lg border-primary text-primary"
                onClick={() => router.push('/works')}
              >
                ยกเลิก
              </Button>
              <Button onClick={handleSave} disabled={saving} className="rounded-lg">
                {saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
              </Button>
            </div>
          </div>
        ) : tab === 'episodes' ? (
          <div>
            {episodesLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
            ) : episodesError ? (
              <p className="py-8 text-center text-sm text-destructive">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>
            ) : (
              <EpisodeListTable
                workUuid={uuid}
                episodes={episodes ?? []}
                isWorkCompleted={data?.completion_status === 'completed'}
                onRefresh={() => refetchEpisodes()}
              />
            )}
          </div>
        ) : (
          <WorkAnalyticsTab workUuid={uuid} />
        )}
      </div>
    </div>
  )
}
