import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WriterLayout } from '../../home/components/writer-layout'
import { CoverImageUpload } from './components/cover-image-upload'

type ContentType = 'novel' | 'cartoon'

interface CreateContentPageProps {
  searchParams: Promise<{
    type?: string | string[]
    title?: string | string[]
  }>
}

const statusOptions = [
  { value: 'draft', label: 'ฉบับร่าง' },
  { value: 'ongoing', label: 'กำลังเผยแพร่' },
  { value: 'completed', label: 'จบแล้ว' },
  { value: 'hiatus', label: 'หยุดชั่วคราว' },
  { value: 'cancelled', label: 'ยกเลิก' },
] as const

const inputClassName = 'h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary'

export default async function CreateContentPage({ searchParams }: CreateContentPageProps) {
  const params = await searchParams
  const contentType: ContentType = params.type === 'cartoon' ? 'cartoon' : 'novel'
  const isCartoon = contentType === 'cartoon'
  const contentLabel = isCartoon ? 'การ์ตูน' : 'นิยาย'
  const databaseType = isCartoon ? 'manga' : 'novel'
  const initialTitle = typeof params.title === 'string' ? params.title : ''

  return (
    <WriterLayout>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link
                href={`/writer/contents/?tab=${contentType}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-4" strokeWidth={1.8} />
                กลับไปหน้าผลงาน
              </Link>
              <h1 className="mt-3 text-2xl font-bold tracking-[-0.025em] md:text-3xl">
                สร้าง{contentLabel}ใหม่
              </h1>
            </div>

            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
              {contentLabel}
            </span>
          </div>

          <form className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(240px,1fr)] lg:items-start">
            <input type="hidden" name="type" value={databaseType} />

            <section className="readji-surface grid gap-5 rounded-2xl p-5 md:grid-cols-2 md:p-6">
              <label className="space-y-2 md:col-span-2">
                <span className="block text-sm font-semibold">
                  ชื่อ{contentLabel} <span className="text-destructive">*</span>
                </span>
                <input
                  type="text"
                  name="title"
                  defaultValue={initialTitle}
                  maxLength={255}
                  required
                  placeholder={`กรอกชื่อ${contentLabel}`}
                  className={inputClassName}
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="block text-sm font-semibold">
                  Slug <span className="text-destructive">*</span>
                </span>
                <input
                  type="text"
                  name="slug"
                  maxLength={255}
                  required
                  placeholder="ตัวอย่าง: my-story-title"
                  className={inputClassName}
                />
                <span className="block text-xs text-muted-foreground">
                  ใช้เป็นส่วนหนึ่งของ URL และต้องไม่ซ้ำกับเนื้อหาอื่น
                </span>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="block text-sm font-semibold">เรื่องย่อ</span>
                <textarea
                  name="synopsis"
                  rows={6}
                  placeholder={`เขียนเรื่องย่อของ${contentLabel}`}
                  className="w-full resize-y rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                />
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-semibold">
                  สถานะ <span className="text-destructive">*</span>
                </span>
                <Select name="status" defaultValue="draft" required>
                  <SelectTrigger className="h-11! w-full rounded-xl px-3">
                    <SelectValue placeholder="เลือกสถานะ" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-semibold">เรทอายุ</span>
                <input
                  type="number"
                  name="age_rating"
                  min={0}
                  step={1}
                  placeholder="ตัวอย่าง: 13"
                  className={inputClassName}
                />
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-semibold">หมวดหมู่</span>
                <select name="genre_ids" disabled defaultValue="" className={inputClassName}>
                  <option value="">ยังไม่มีข้อมูลหมวดหมู่</option>
                </select>
              </label>
            </section>

            <aside className="readji-surface rounded-2xl p-5 md:p-6">
              <CoverImageUpload />
            </aside>

            <div className="flex justify-end gap-3 border-t border-border pt-5 lg:col-span-2">
              <Link
                href={`/writer/contents/?tab=${contentType}`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold transition-colors hover:bg-accent"
              >
                ยกเลิก
              </Link>
              <button
                type="submit"
                className="min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                บันทึกฉบับร่าง
              </button>
            </div>
          </form>
        </div>
      </main>
    </WriterLayout>
  )
}
