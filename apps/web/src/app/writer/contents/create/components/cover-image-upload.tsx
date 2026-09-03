'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Eye, Image as ImageIcon, LoaderCircle, UploadCloud, X } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { StoryCard } from '@/components/common/story-card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { uploadWriterCover } from '@/lib/api'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const placeholderStories = [
  { id: 'placeholder-1', title: 'ตัวอย่างเนื้อหา 1' },
  { id: 'placeholder-2', title: 'ตัวอย่างเนื้อหา 2' },
  { id: 'placeholder-3', title: 'ตัวอย่างเนื้อหา 3' },
] as const

export function CoverImageUpload() {
  const { accessToken, user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [coverUrl, setCoverUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('ชื่อเรื่องของคุณ')
  const [previewType, setPreviewType] = useState<'novel' | 'manga'>('novel')

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    const form = inputRef.current?.form
    if (!form) return

    const handleSubmit = async (event: SubmitEvent) => {
      event.preventDefault()
      if (!selectedFile || isUploading || coverUrl) return

      if (!accessToken) {
        setError('ไม่พบข้อมูลการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง')
        return
      }

      setError(null)
      setIsUploading(true)

      try {
        const result = await uploadWriterCover(selectedFile, accessToken)
        setCoverUrl(result.cover_url)
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : 'ไม่สามารถอัปโหลดรูปปกได้')
      } finally {
        setIsUploading(false)
      }
    }

    form.addEventListener('submit', handleSubmit)
    return () => form.removeEventListener('submit', handleSubmit)
  }, [accessToken, coverUrl, isUploading, selectedFile])

  const clearSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (inputRef.current) inputRef.current.value = ''
    setPreviewUrl(null)
    setSelectedFile(null)
    setCoverUrl('')
    setFileName('')
    setError(null)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setCoverUrl('')

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      clearSelection()
      setError('รองรับเฉพาะไฟล์ JPG, PNG และ WebP')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      clearSelection()
      setError('ขนาดไฟล์ต้องไม่เกิน 5 MB')
      return
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const nextPreviewUrl = URL.createObjectURL(file)
    setPreviewUrl(nextPreviewUrl)
    setSelectedFile(file)
    setFileName(file.name)
  }

  const prepareWebsitePreview = () => {
    const form = inputRef.current?.form
    const titleInput = form?.elements.namedItem('title')
    const typeInput = form?.elements.namedItem('type')

    if (titleInput instanceof HTMLInputElement) {
      setPreviewTitle(titleInput.value.trim() || 'ชื่อเรื่องของคุณ')
    }

    if (typeInput instanceof HTMLInputElement) {
      setPreviewType(typeInput.value === 'manga' ? 'manga' : 'novel')
    }
  }

  return (
    <div className="space-y-3">
      <Label htmlFor="cover-file" className="text-sm font-semibold">รูปปก</Label>
      <input type="hidden" name="cover_url" value={coverUrl} />

      {previewUrl ? (
        <div className="rounded-2xl border border-border p-3">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-muted">
            <img src={previewUrl} alt="ตัวอย่างรูปปก" className="size-full object-cover" />
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                <LoaderCircle className="size-7 animate-spin text-white" strokeWidth={2} />
              </div>
            )}
          </div>

          <div className="mt-3 min-w-0">
            <p className="truncate text-sm font-semibold">{fileName}</p>
            <p className={`mt-1 text-xs ${error ? 'text-destructive' : 'text-muted-foreground'}`}>
              {isUploading
                ? 'กำลังอัปโหลดไปยัง R2...'
                : error ?? (coverUrl ? 'อัปโหลดรูปปกสำเร็จ' : 'พร้อมอัปโหลดเมื่อกดบันทึกฉบับร่าง')}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                เปลี่ยนรูป
              </button>
              <button
                type="button"
                onClick={clearSelection}
                disabled={isUploading}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="size-3.5" strokeWidth={2} />
                นำรูปออก
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[3/4] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border px-5 py-8 text-center transition-colors hover:border-primary hover:bg-primary/5"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
            <UploadCloud className="size-6" strokeWidth={1.8} />
          </span>
          <span className="mt-3 text-sm font-bold">เลือกไฟล์รูปปก</span>
          <span className="mt-1 text-xs text-muted-foreground">JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB</span>
          <span className="mt-1 text-xs text-muted-foreground">ขนาดแนะนำ 1200 × 1600 px</span>
        </button>
      )}

      {previewUrl && (
        <>
          <p className="text-xs text-muted-foreground">ขนาดแนะนำ 1200 × 1600 px</p>

          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                onClick={prepareWebsitePreview}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold transition-colors hover:bg-accent"
              >
                <Eye className="size-4" strokeWidth={1.8} />
                แสดงตัวอย่าง
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>ตัวอย่างการแสดงผลหน้าเว็บ</DialogTitle>
                <DialogDescription>
                  ตัวอย่างนี้ใช้รูปปกและข้อมูลที่กรอกในปัจจุบัน
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-2xl bg-white p-4 md:p-6">
                <h3 className="mb-4 text-lg font-bold text-zinc-950">เนื้อหาอัปเดตล่าสุด</h3>
                <div className="pointer-events-none grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StoryCard
                    title={placeholderStories[0].title}
                    image="/placeholder.svg"
                    episode="ตอนล่าสุด"
                    author="ชื่อผู้เขียน"
                    meta="0 ครั้ง"
                    type={previewType}
                  />
                  <StoryCard
                    title={previewTitle}
                    image={previewUrl}
                    episode="ยังไม่มีตอน"
                    author={user?.display_name || 'ชื่อผู้เขียน'}
                    meta="0 ครั้ง"
                    type={previewType}
                    eager
                  />
                  {placeholderStories.slice(1).map((story) => (
                    <StoryCard
                      key={story.id}
                      title={story.title}
                      image="/placeholder.svg"
                      episode="ตอนล่าสุด"
                      author="ชื่อผู้เขียน"
                      meta="0 ครั้ง"
                      type={previewType}
                    />
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      <Input
        id="cover-file"
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="เลือกไฟล์รูปปก"
      />

      {error && !previewUrl && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <ImageIcon className="size-3.5" strokeWidth={1.8} />
          {error}
        </p>
      )}
    </div>
  )
}
