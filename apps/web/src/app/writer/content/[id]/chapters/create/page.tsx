'use client'

import {
  use,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftIcon,
  ImagePlusIcon,
  LoaderCircleIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth/auth-provider'
import { RichTextEditor } from '@/components/common/rich-text-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StoryType } from '@/constants/story.constant'
import { createWriterChapter, getWriterContent } from '@/controllers/writer.controller'
import type { ChapterStatus } from '@/interface/writer-chapter.interface'

const chapterStatusOptions: { value: ChapterStatus; label: string }[] = [
  { value: 'draft', label: 'ฉบับร่าง' },
  { value: 'scheduled', label: 'ตั้งเวลาเผยแพร่' },
  { value: 'published', label: 'เผยแพร่แล้ว' },
  { value: 'hidden', label: 'ซ่อน' },
]

interface ChapterImage {
  id: string
  file: File
  previewUrl: string
}

interface CreateChapterPageProps {
  params: Promise<{ id: string }>
}

export default function CreateChapterPage({ params }: CreateChapterPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { accessToken, status: authStatus } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imagesRef = useRef<ChapterImage[]>([])
  const [storyType, setStoryType] = useState<StoryType | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [chapterStatus, setChapterStatus] = useState<ChapterStatus>('draft')
  const [images, setImages] = useState<ChapterImage[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const chaptersHref = `/writer/content/${id}/chapters`

  useEffect(() => {
    if (!accessToken) {
      if (authStatus === 'unauthenticated') {
        setLoadError('ไม่พบข้อมูลการเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง')
      }
      return
    }

    let cancelled = false
    setLoadError(null)

    void getWriterContent(id, accessToken)
      .then(({ story }) => {
        if (!cancelled) setStoryType(story.type)
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลผลงานได้')
        }
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, authStatus, id])

  useEffect(() => {
    imagesRef.current = images
  }, [images])

  useEffect(() => () => {
    for (const image of imagesRef.current) URL.revokeObjectURL(image.previewUrl)
  }, [])

  const addImages = (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    setImages((current) => [
      ...current,
      ...imageFiles.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ])
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    addImages(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsDragging(false)
    addImages(Array.from(event.dataTransfer.files))
  }

  const removeImage = (imageId: string) => {
    setImages((current) => {
      const removedImage = current.find((image) => image.id === imageId)
      if (removedImage) URL.revokeObjectURL(removedImage.previewUrl)
      return current.filter((image) => image.id !== imageId)
    })
  }

  const clearImages = () => {
    for (const image of images) URL.revokeObjectURL(image.previewUrl)
    setImages([])
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting || !accessToken || !storyType) return

    if (isCartoon && images.length === 0) {
      setSubmitError('กรุณาเพิ่มรูปภาพอย่างน้อย 1 รูป')
      return
    }

    const body = new FormData(event.currentTarget)
    body.delete('images')
    if (isCartoon) {
      for (const image of images) body.append('images', image.file)
    }

    if (chapterStatus === 'scheduled') {
      const scheduledAt = body.get('published_at')
      if (typeof scheduledAt !== 'string' || !scheduledAt) {
        setSubmitError('กรุณาระบุวันและเวลาเผยแพร่')
        return
      }
      body.set('published_at', new Date(scheduledAt).toISOString())
    } else {
      body.delete('published_at')
    }

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await createWriterChapter(id, body, accessToken)
      toast.success('สร้างตอนเรียบร้อยแล้ว')
      router.push(chaptersHref)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ไม่สามารถสร้างตอนได้'
      setSubmitError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!storyType && !loadError) {
    return (
      <section className="mt-6 space-y-5">
        <Skeleton className="h-11 w-28 rounded-xl" />
        <div className="readji-surface grid gap-5 rounded-2xl p-5 md:grid-cols-2 md:p-6">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          ))}
          <div className="space-y-2 md:col-span-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        </div>
      </section>
    )
  }

  if (loadError) {
    return (
      <section className="mt-6">
        <div className="readji-surface rounded-2xl p-8 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button asChild variant="outline" className="mt-4 h-11 rounded-xl">
            <Link href={chaptersHref}>
              <ArrowLeftIcon />
              ย้อนกลับ
            </Link>
          </Button>
        </div>
      </section>
    )
  }

  const isCartoon = storyType === StoryType.MANGA

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <Link href={chaptersHref}>
            <ArrowLeftIcon />
            ย้อนกลับ
          </Link>
        </Button>
        <span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
          {isCartoon ? 'การ์ตูน' : 'นิยาย'}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <section className="readji-surface grid gap-5 rounded-2xl p-5 md:grid-cols-2 md:p-6">
          <div className="space-y-2">
            <Label htmlFor="chapter-title" className="text-sm font-semibold">
              ชื่อตอน <span className="text-destructive">*</span>
            </Label>
            <Input
              id="chapter-title"
              name="title"
              placeholder="กรอกชื่อตอน"
              maxLength={255}
              required
              className="h-11 rounded-xl px-3"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="chapter-number" className="text-sm font-semibold">
              ตอนที่ <span className="text-destructive">*</span>
            </Label>
            <Input
              id="chapter-number"
              name="chapter_number"
              type="number"
              min={0}
              step="0.01"
              placeholder="กรอกเลขตอน"
              required
              className="h-11 rounded-xl px-3"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="chapter-price" className="text-sm font-semibold">
              ราคา
            </Label>
            <Input
              id="chapter-price"
              name="price"
              type="number"
              min={0}
              step="0.01"
              defaultValue="0"
              placeholder="0 = ฟรี"
              className="h-11 rounded-xl px-3"
            />
            <p className="text-xs text-muted-foreground">กำหนดราคาเป็น 0 สำหรับตอนอ่านฟรี</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chapter-status" className="text-sm font-semibold">
              สถานะ <span className="text-destructive">*</span>
            </Label>
            <Select
              name="status"
              value={chapterStatus}
              onValueChange={(value) => setChapterStatus(value as ChapterStatus)}
            >
              <SelectTrigger id="chapter-status" className="h-11! w-full rounded-xl px-3">
                <SelectValue placeholder="เลือกสถานะ" />
              </SelectTrigger>
              <SelectContent>
                {chapterStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {chapterStatus === 'scheduled' && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="chapter-published-at" className="text-sm font-semibold">
                วันและเวลาเผยแพร่ <span className="text-destructive">*</span>
              </Label>
              <Input
                id="chapter-published-at"
                name="published_at"
                type="datetime-local"
                required
                className="h-11 rounded-xl px-3"
              />
            </div>
          )}
        </section>

        {isCartoon ? (
          <section className="readji-surface rounded-2xl p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <Label className="text-sm font-semibold">
                รูปภาพ ({images.length} รูป) <span className="text-destructive">*</span>
              </Label>
              {images.length > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={clearImages}>
                  <Trash2Icon />
                  เลือกลบ
                </Button>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              className={`flex min-h-36 w-full flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary hover:bg-primary/5'
              }`}
            >
              <ImagePlusIcon className="size-9 text-muted-foreground" strokeWidth={1.8} />
              <span className="mt-3 text-sm font-bold">คลิกเพื่อเพิ่มรูปภาพ</span>
              <span className="mt-1 text-xs text-muted-foreground">หรือลากไฟล์มาวางที่นี่</span>
            </button>
            <Input
              ref={fileInputRef}
              type="file"
              name="images"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="sr-only"
              aria-label="เลือกรูปภาพตอนการ์ตูน"
            />

            {images.length > 0 && (
              <div className="mt-4 max-h-[26rem] overflow-y-auto rounded-xl border border-border p-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {images.map((image, index) => (
                    <article key={image.id} className="relative rounded-xl border border-border p-2">
                      <span className="absolute top-2 left-2 z-10 flex size-6 items-center justify-center rounded-full bg-background/90 text-xs font-bold shadow-sm">
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeImage(image.id)}
                        aria-label={`ลบรูปที่ ${index + 1}`}
                        className="absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-lg bg-destructive text-destructive-foreground shadow-sm transition-opacity hover:opacity-90"
                      >
                        <XIcon className="size-4" />
                      </button>
                      <div className="aspect-[3/4] overflow-hidden rounded-lg bg-muted">
                        <img
                          src={image.previewUrl}
                          alt={`ตัวอย่างรูปที่ ${index + 1}: ${image.file.name}`}
                          className="size-full object-cover"
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="readji-surface rounded-2xl p-5 md:p-6">
            <div className="space-y-2">
              <Label htmlFor="chapter-content" className="text-sm font-semibold">
                เนื้อหา <span className="text-destructive">*</span>
              </Label>
              <RichTextEditor id="chapter-content" />
            </div>
          </section>
        )}

        <div className="flex justify-end gap-3 border-t border-border pt-5">
          {submitError && (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {submitError}
            </p>
          )}
          <Button asChild type="button" variant="outline" className="h-11 rounded-xl px-5">
            <Link href={chaptersHref}>ยกเลิก</Link>
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 rounded-xl px-5 font-bold"
          >
            {isSubmitting && <LoaderCircleIcon className="animate-spin" />}
            {isSubmitting ? 'กำลังสร้าง...' : 'สร้าง'}
          </Button>
        </div>
      </form>
    </section>
  )
}
