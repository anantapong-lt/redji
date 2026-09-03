'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Image as ImageIcon, UploadCloud, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  STORY_COVER_ACCEPTED_TYPES,
  STORY_COVER_MAX_FILE_SIZE,
} from '@/constants/story.constant'
import { useCreateStoryForm } from './create-story-form'

interface CoverImageUploadProps {
  initialCoverUrl?: string | null
  showRemoveButton?: boolean
}

export function CoverImageUpload({
  initialCoverUrl = null,
  showRemoveButton = true,
}: CoverImageUploadProps) {
  const { clearFieldError, errors } = useCreateStoryForm()
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialCoverUrl)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isExistingCoverRemoved, setIsExistingCoverRemoved] = useState(false)

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const clearSelection = () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    if (inputRef.current) inputRef.current.value = ''
    setPreviewUrl(null)
    setFileName('')
    setError(null)
    setIsExistingCoverRemoved(Boolean(initialCoverUrl))
    clearFieldError('cover')
  }

  const rejectSelection = (message: string) => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    if (inputRef.current) inputRef.current.value = ''
    setPreviewUrl(initialCoverUrl)
    setFileName('')
    setError(message)
    setIsExistingCoverRemoved(false)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    clearFieldError('cover')

    if (!STORY_COVER_ACCEPTED_TYPES.includes(
      file.type as (typeof STORY_COVER_ACCEPTED_TYPES)[number],
    )) {
      rejectSelection('รองรับเฉพาะไฟล์ JPG, PNG และ WebP')
      return
    }

    if (file.size > STORY_COVER_MAX_FILE_SIZE) {
      rejectSelection('ขนาดไฟล์ต้องไม่เกิน 5 MB')
      return
    }

    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    const nextPreviewUrl = URL.createObjectURL(file)
    setPreviewUrl(nextPreviewUrl)
    setFileName(file.name)
    setIsExistingCoverRemoved(false)
  }

  return (
    <div className="space-y-3" data-field="cover">
      <Label htmlFor="cover-file" className="text-sm font-semibold">รูปปก</Label>

      {previewUrl ? (
        <div className="rounded-2xl border border-border p-3">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-muted">
            <img src={previewUrl} alt="ตัวอย่างรูปปก" className="size-full object-cover" />
          </div>

          <div className="mt-3 min-w-0">
            <p className="truncate text-sm font-semibold">
              {fileName || 'รูปปกปัจจุบัน'}
            </p>
            <p className={`mt-1 text-xs ${error ? 'text-destructive' : 'text-muted-foreground'}`}>
              {error ?? (fileName ? 'พร้อมส่งพร้อมข้อมูลเมื่อกดบันทึก' : 'รูปปกที่ใช้งานอยู่')}
            </p>
            <div className={`mt-3 grid gap-2 ${showRemoveButton ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent"
              >
                เปลี่ยนรูป
              </button>
              {showRemoveButton && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                >
                  <X className="size-3.5" strokeWidth={2} />
                  นำรูปออก
                </button>
              )}
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
        <p className="text-xs text-muted-foreground">ขนาดแนะนำ 1200 × 1600 px</p>
      )}

      <Input
        id="cover-file"
        ref={inputRef}
        type="file"
        name="cover"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="เลือกไฟล์รูปปก"
        aria-invalid={Boolean(errors.cover)}
        aria-describedby={errors.cover ? 'cover-error' : undefined}
      />

      {isExistingCoverRemoved && (
        <input type="hidden" name="remove_cover" value="true" />
      )}

      {error && !previewUrl && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <ImageIcon className="size-3.5" strokeWidth={1.8} />
          {error}
        </p>
      )}
      {errors.cover && (
        <p id="cover-error" className="flex items-center gap-1.5 text-xs text-destructive">
          <ImageIcon className="size-3.5" strokeWidth={1.8} />
          {errors.cover}
        </p>
      )}
    </div>
  )
}
