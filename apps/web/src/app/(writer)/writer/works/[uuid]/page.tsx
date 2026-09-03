'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, ExternalLink } from 'lucide-react'
import type { JSONContent } from '@tiptap/react'
import { formatThaiDateTime, cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { EditableCover } from '@/components/writer/editable-cover'
import { SearchableSelect } from '@/components/writer/searchable-select'
import { TagAutocompleteInput } from '@/components/writer/tag-autocomplete-input'
import { RichTextEditor } from '@/components/writer/rich-text-editor'
import { EpisodeListTable, type WriterEpisodeRow } from '@/components/writer/episode-list-table'
import { WorkAnalyticsTab } from '@/components/writer/work-analytics-tab'
import { WorkAudioEditor } from '@/app/(writer)/writer/audio-edit/page'
import { SpecialTagPill } from '@/components/works/special-tag-badges'
import { SPECIAL_TAG_STYLES, splitTags } from '@/lib/special-tags'
import type { CategoryRef, AgeRate } from '@/types'

// รูปทรงตรงกับ GET /categories จริง (ดู works.service.ts getCategories()) — เดิมหน้านี้ใช้
// MOCK_CATEGORIES (lib/mock-categories.ts) ที่ hardcode ไว้ในหน้าเว็บ ทั้งที่ endpoint จริงมีอยู่
// แล้วและหน้า /search ก็ดึงจากตรงนี้อยู่แล้ว (2026-07-29 user ถามว่าทำไมไม่ดึงจาก DB)
interface ApiCategory {
  id: string
  name: string
}

// รูปทรงตรงกับที่ GET /writer/works/:uuid ส่งจริง (ดู getWorkForEdit ใน writer.service.ts)
interface ApiWork {
  uuid: string
  title: string
  original_title: string | null
  description: string | null
  synopsis: JSONContent | null
  cover_image: string | null
  type: 'manga' | 'novel'
  age_rate: AgeRate
  is_translated: boolean
  tags: string[]
  is_one_shot: boolean
  completion_status: 'ongoing' | 'completed' | 'hiatus' | null
  publish_status: 0 | 1
  category_main: { id: string; name: string } | null
  category_sub: { id: string; name: string } | null
  created_at: string
  updated_at: string
}

const TABS = [
  { key: 'detail', label: 'รายละเอียด' },
  { key: 'episodes', label: 'รายตอน' },
  { key: 'analytics', label: 'สถิติเจาะลึก' },
  { key: 'audio-edit', label: 'แก้ไขเสียง' },
] as const

type TabKey = (typeof TABS)[number]['key']

const INPUT_CLASS =
  'h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

// key={uuid} บังคับ React unmount+remount ทั้งก้อนทุกครั้งที่ uuid เปลี่ยน (2026-08-05 — บั๊กจริงที่
// เจอในหน้าคู่กันฝั่งแอดมิน: Next.js App Router ไม่ remount component เองเวลาแค่ dynamic segment
// เปลี่ยน (คนละ route "รูปร่าง" เดิม) ทำให้ state ในตัว (tab ที่เลือกไว้, ฟอร์มที่พิมพ์ค้างไว้ ฯลฯ)
// จากผลงานเก่าอาจค้างโผล่มาปนกับผลงานใหม่ชั่วครู่ระหว่าง query ตัวใหม่ยังโหลดไม่เสร็จ — แก้จุดเดียวกัน
// ไว้ที่นี่ด้วยเผื่อกัน แม้ความเสี่ยงจะต่ำกว่าฝั่งแอดมิน (นักเขียนเห็นแค่ผลงานตัวเองอยู่แล้ว)
export default function EditWorkPage() {
  const { uuid } = useParams<{ uuid: string }>()
  return <EditWorkContent key={uuid} uuid={uuid} />
}

function EditWorkContent({ uuid }: { uuid: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabKey>('detail')

  const { data, isLoading, isError, refetch: refetchWork } = useQuery({
    queryKey: ['writer', 'work', uuid],
    queryFn: () => api.get<{ data: ApiWork }>(`/writer/works/${uuid}`).then((res) => res.data),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ data: ApiCategory[] }>('/categories').then((res) => res.data),
  })
  const categories: CategoryRef[] = (categoriesData ?? []).map((c) => ({ id: Number(c.id), name: c.name }))

  const {
    data: episodes,
    isLoading: episodesLoading,
    isError: episodesError,
    refetch: refetchEpisodes,
  } = useQuery({
    queryKey: ['writer', 'work', uuid, 'episodes'],
    queryFn: () => api.get<{ data: WriterEpisodeRow[] }>(`/writer/works/${uuid}/episodes`).then((res) => res.data),
    enabled: tab === 'episodes',
  })

  async function handleDeleteEpisodes(epIds: string[]) {
    try {
      await Promise.all(epIds.map((epId) => api.delete(`/writer/episodes/${epId}`)))
      refetchEpisodes()
    } catch (err: any) {
    }
  }

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

  // เติมค่าเริ่มต้นจากข้อมูลจริงตอนโหลดเสร็จ (ครั้งเดียว)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // หมวดหมู่ย่อยพิเศษ (BL/GL) ไม่มี state แยกอีกต่อไป (2026-08-05 rev.2) — เป็นแค่ string ธรรมดาใน
  // tags[] เอง เช็ค checked ตรงจาก tags.includes() สวิชแค่เป็นทางลัดเพิ่ม/เอาออกจาก tags ให้เร็วกว่า
  // ต้องพิมพ์เอง (พิมพ์เองก็ได้เหมือนกันผ่านช่องหมวดหมู่เสริมด้านล่าง) — ต้องอยู่ลำดับแรกสุดเสมอ
  const isBL = tags.includes(SPECIAL_TAG_STYLES.bl.label)
  const isGL = tags.includes(SPECIAL_TAG_STYLES.gl.label)

  function toggleSpecialTag(name: string, enabled: boolean) {
    setTags((prev) => (enabled ? [name, ...prev.filter((t) => t !== name)] : prev.filter((t) => t !== name)))
  }

  async function handleSave() {
    if (!title.trim()) {
      return
    }

    setSaving(true)
    try {
      await api.patch(`/writer/works/${uuid}`, {
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
        await api.post(`/writer/works/${uuid}/cover`, formData)
      }

      // เดิม save แล้ว push ออกไปหน้า dashboard เลย ไม่เคย invalidate cache ของหน้านี้
      // (['writer', 'work', uuid]) — root cause เดียวกับที่แก้ไปทั้ง 5 จุดก่อนหน้า (ดู
      // KNOWN_ISSUES.md 2026-07-29): ถ้ากลับมาเปิดหน้าแก้ไขเรื่องเดิมซ้ำภายใน staleTime (60 วิ)
      // จะเห็นข้อมูลก่อนเซฟย้อนกลับมา ทั้งที่บันทึกถูกต้องแล้วจริง — invalidate แทน patch ตรงๆ
      // เพราะเป็นฟอร์มเต็มหน้า (หลาย field พร้อมกัน) ไม่ใช่ toggle เดี่ยวๆ แบบ 5 จุดที่ใช้
      // useOptimisticToggle ได้ — ปลอดภัยกว่าให้ query ถัดไปยิงขอข้อมูลจริงมาใหม่ทั้งก้อน
      await queryClient.invalidateQueries({ queryKey: ['writer', 'work', uuid] })
      // เดิมลืม invalidate query "ลิสต์ทั้งหมด" ด้วย (['writer','works']) — หน้า /writer/dashboard
      // ที่ redirect ไปหลังเซฟใช้ query นี้แสดงผล พอไม่ invalidate ลิสต์เลยค้างข้อมูลเก่า (เช่น
      // publish_status ที่เพิ่งเปลี่ยน) จนกว่าจะ refresh มือหรือ 60s staleTime หมดอายุเอง
      // (2026-08-11 user เจอเอง)
      await queryClient.invalidateQueries({ queryKey: ['writer', 'works'] })

      router.push('/writer/dashboard')
    } catch (err: any) {
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-foreground">นิยาย</h1>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Link href="/writer/dashboard" className="hover:text-foreground">
            นิยายของฉัน
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">{data?.title ?? 'กำลังโหลด...'}</span>
        </div>
        {data && (
          <Link
            href={`/works/${uuid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex cursor-pointer items-center gap-1.5 text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" />
            ดูหน้านิยายจริง
          </Link>
        )}
      </div>

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
          <p className="py-8 text-center text-sm text-destructive">
            โหลดข้อมูลไม่สำเร็จ — อาจไม่พบนิยายเรื่องนี้ หรือไม่ใช่ของคุณ
          </p>
        ) : tab === 'detail' ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
              <EditableCover src={data.cover_image} onChange={setCover} />

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      ชื่อเรื่อง
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      ชื่อเรื่องต้นฉบับ
                    </label>
                    <input
                      value={originalTitle}
                      onChange={(e) => setOriginalTitle(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-4">
                  <div className="w-36">
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      หมวดหมู่หลัก
                    </label>
                    <SearchableSelect
                      options={categories}
                      value={categoryMain}
                      onChange={setCategoryMain}
                    />
                  </div>
                  <div className="w-36">
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      หมวดหมู่รอง
                    </label>
                    <SearchableSelect
                      options={categories}
                      value={categorySub}
                      onChange={setCategorySub}
                    />
                  </div>
                  <div className="w-36">
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      ประเภทนิยาย
                    </label>
                    <Select value={novelType} onValueChange={setNovelType}>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue placeholder="ทั้งหมด" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="translated">นิยายแปล</SelectItem>
                        <SelectItem value="original">แต่งเอง</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-40">
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      ระดับการเผยแพร่
                    </label>
                    <Select value={publishLevel} onValueChange={setPublishLevel}>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue placeholder="ยังไม่เผยแพร่" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">ยังไม่เผยแพร่</SelectItem>
                        <SelectItem value="published">เผยแพร่แล้ว</SelectItem>
                        <SelectItem value="scheduled">ตั้งเวลาเผยแพร่</SelectItem>
                      </SelectContent>
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
                  <label className="flex cursor-pointer items-center gap-2 pb-1.5">
                    <Switch checked={isBL} onCheckedChange={(v) => toggleSpecialTag(SPECIAL_TAG_STYLES.bl.label, v)} />
                    <span className={cn('text-sm font-semibold', SPECIAL_TAG_STYLES.bl.labelText)}>BL</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 pb-1.5">
                    <Switch checked={isGL} onCheckedChange={(v) => toggleSpecialTag(SPECIAL_TAG_STYLES.gl.label, v)} />
                    <span className={cn('text-sm font-semibold', SPECIAL_TAG_STYLES.gl.labelText)}>GL</span>
                  </label>
                </div>

                {/* กดสวิชแล้ว "เด้งลงมา" โชว์ตัวอย่าง pill สีจริงที่ปักไว้ลำดับแรกสุดของหมวดหมู่เสริม
                    ด้านล่าง (สื่อถึงความพิเศษ) — ไม่นับ 18+ ตามที่ user ระบุ (BL/GL เท่านั้น) */}
                {splitTags(tags).special && (
                  <div className="flex animate-in items-center gap-1.5 fade-in slide-in-from-top-1 duration-200">
                    <SpecialTagPill tag={splitTags(tags).special!} />
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    หมวดหมู่เสริม
                  </label>
                  <TagAutocompleteInput tags={tags} onChange={setTags} />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    คำโปรย
                  </label>
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
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                แนะนำเรื่อง/เรื่องย่อ/พรรณนา
              </label>
              <RichTextEditor content={synopsis} onChange={setSynopsis} />
            </div>

            <div className="flex justify-center gap-3">
              <Button asChild variant="outline" className="rounded-lg border-primary text-primary">
                <Link href="/writer/dashboard">ยกเลิก</Link>
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
                isWorkCompleted={data.completion_status === 'completed'}
                isNovel={data.type === 'novel'}
                onDeleteMany={handleDeleteEpisodes}
                onRefresh={() => refetchEpisodes()}
                onEpisodeCreated={() => refetchEpisodes()}
              />
            )}
          </div>
        ) : tab === 'analytics' ? (
          <WorkAnalyticsTab workUuid={uuid} />
        ) : (
          <WorkAudioEditor workUuid={uuid} />
        )}
      </div>
    </div>
  )
}
