'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { CoverUpload } from '@/components/writer/cover-upload'
import { SearchableSelect } from '@/components/writer/searchable-select'
import { TagAutocompleteInput } from '@/components/writer/tag-autocomplete-input'
import { SpecialTagPill } from '@/components/works/special-tag-badges'
import { SPECIAL_TAG_STYLES, splitTags } from '@/lib/special-tags'
import type { CategoryRef } from '@/types'

// รูปทรงตรงกับ GET /categories จริง (ดู works.service.ts getCategories()) — เดิมหน้านี้ใช้
// MOCK_CATEGORIES (lib/mock-categories.ts) ที่ hardcode ไว้ในหน้าเว็บ ทั้งที่ endpoint จริงมีอยู่
// แล้วและหน้า /search ก็ดึงจากตรงนี้อยู่แล้ว (2026-07-29 user ถามว่าทำไมไม่ดึงจาก DB)
interface ApiCategory {
  id: string
  name: string
}

const INPUT_CLASS =
  'h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export default function NewWorkPage() {
  const router = useRouter()

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ data: ApiCategory[] }>('/categories').then((res) => res.data),
  })
  const categories: CategoryRef[] = (categoriesData ?? []).map((c) => ({ id: Number(c.id), name: c.name }))

  const [title, setTitle] = useState('')
  const [originalTitle, setOriginalTitle] = useState('')
  const [categoryMain, setCategoryMain] = useState<CategoryRef | null>(null)
  const [categorySub, setCategorySub] = useState<CategoryRef | null>(null)
  const [novelType, setNovelType] = useState('')
  const [is18Plus, setIs18Plus] = useState(false)
  const [isOneShot, setIsOneShot] = useState(false)
  const [extraTags, setExtraTags] = useState<string[]>([])
  const [blurb, setBlurb] = useState('')
  const [cover, setCover] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  // หมวดหมู่ย่อยพิเศษ (BL/GL) ไม่มี state แยก — เป็น string ธรรมดาใน extraTags เอง (ดูเหตุผลเดียวกัน
  // ในหน้าแก้ไขนิยาย writer/works/[uuid]/page.tsx)
  const isBL = extraTags.includes(SPECIAL_TAG_STYLES.bl.label)
  const isGL = extraTags.includes(SPECIAL_TAG_STYLES.gl.label)

  function toggleSpecialTag(name: string, enabled: boolean) {
    setExtraTags((prev) => (enabled ? [name, ...prev.filter((t) => t !== name)] : prev.filter((t) => t !== name)))
  }

  async function handleSaveDraft() {
    if (!title.trim()) {
      return
    }

    setSaving(true)
    try {
      // สร้างนิยายก่อน — ยังไม่มีช่องเลือก type ในฟอร์มนี้ hardcode เป็น 'novel'
      // เพราะหน้านี้คือ "เพิ่มนิยายใหม่" โดยเฉพาะ (มังงะจะมีฟอร์มแยกทีหลัง)
      const work = await api
        .post<{ data: { uuid: string } }>('/writer/works', {
          title: title.trim(),
          original_title: originalTitle.trim() || undefined,
          description: blurb.trim() || undefined,
          type: 'novel',
          category_main: categoryMain?.id,
          category_sub: categorySub?.id,
          age_rate: is18Plus ? '18+' : 'all',
          is_translated: novelType === 'translated',
          tags: extraTags,
          is_one_shot: isOneShot,
        })
        .then((res) => res.data)

      // ถ้ามีไฟล์ปก อัปโหลดแยกอีกที (ต้องมี uuid ของนิยายก่อนถึงจะอัปโหลดได้)
      if (cover) {
        const formData = new FormData()
        formData.append('cover', cover)
        await api.post(`/writer/works/${work.uuid}/cover`, formData)
      }

      router.push('/writer/dashboard')
    } catch (err: any) {
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-foreground">นิยาย</h1>
      <div className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/writer/dashboard" className="hover:text-foreground">
          นิยาย
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">เพิ่มนิยายใหม่</span>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[300px_1fr]">
        <CoverUpload onChange={setCover} />

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">ชื่อเรื่อง</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT_CLASS} />
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
            <div className="w-40">
              <label className="mb-1.5 block text-sm font-medium text-foreground">หมวดหมู่หลัก</label>
              <SearchableSelect options={categories} value={categoryMain} onChange={setCategoryMain} />
            </div>
            <div className="w-40">
              <label className="mb-1.5 block text-sm font-medium text-foreground">หมวดหมู่รอง</label>
              <SearchableSelect options={categories} value={categorySub} onChange={setCategorySub} />
            </div>
            <div className="w-40">
              <label className="mb-1.5 block text-sm font-medium text-foreground">ประเภทนิยาย</label>
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
            <label className="flex cursor-pointer items-center gap-2 pb-1.5">
              <Switch checked={isOneShot} onCheckedChange={setIsOneShot} />
              <span className="text-sm text-foreground">one shot</span>
            </label>
          </div>

          {splitTags(extraTags).special && (
            <div className="-mt-2 flex animate-in items-center gap-1.5 fade-in slide-in-from-top-1 duration-200">
              <SpecialTagPill tag={splitTags(extraTags).special!} />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">หมวดหมู่เสริม</label>
            <TagAutocompleteInput tags={extraTags} onChange={setExtraTags} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">คำโปรย</label>
            <textarea
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              rows={5}
              className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <div>
            <Button onClick={handleSaveDraft} disabled={saving} className="rounded-lg">
              {saving ? 'กำลังบันทึก...' : 'บันทึกฉบับร่าง'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
