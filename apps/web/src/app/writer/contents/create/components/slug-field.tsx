'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { STORY_SLUG_MAX_LENGTH } from '@/constants/story.constant'
import { SITE_CONFIG } from '@/site.config'
import { useCreateStoryForm } from './create-story-form'

interface SlugFieldProps {
  initialSlug?: string
  allowAutoGenerate?: boolean
}

export function SlugField({
  initialSlug = '',
  allowAutoGenerate = false,
}: SlugFieldProps) {
  const { clearFieldError, errors } = useCreateStoryForm()
  const [slug, setSlug] = useState(initialSlug)
  const [autoGenerate, setAutoGenerate] = useState(false)
  const previewSlug = slug.trim() || 'your-story-slug'
  const siteUrl = SITE_CONFIG.siteUrl.replace(/\/$/, '')

  return (
    <div className="space-y-2 md:col-span-2" data-field="slug">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="slug" className="text-sm font-semibold">
          ลิงก์ URL{!autoGenerate && <span className="text-destructive">*</span>}
        </Label>
        {allowAutoGenerate && (
          <Label
            htmlFor="auto-generate-slug"
            className="flex cursor-pointer items-center gap-2 text-sm font-normal text-muted-foreground"
          >
            <Checkbox
              id="auto-generate-slug"
              name="auto_generate_slug"
              value="true"
              checked={autoGenerate}
              onCheckedChange={(checked) => {
                setAutoGenerate(checked === true)
                clearFieldError('slug')
              }}
            />
            สร้างลิงก์ URL อัตโนมัติ
          </Label>
        )}
      </div>
      <Input
        id="slug"
        type="text"
        name="slug"
        value={slug}
        disabled={autoGenerate}
        onChange={(event) => {
          setSlug(event.target.value)
          clearFieldError('slug')
        }}
        maxLength={STORY_SLUG_MAX_LENGTH}
        aria-invalid={Boolean(errors.slug)}
        aria-describedby={errors.slug ? 'slug-error' : undefined}
        placeholder="ตัวอย่าง: my-story-title"
        className="h-11 rounded-xl px-3"
      />
      {errors.slug && (
        <p id="slug-error" className="text-xs text-destructive">{errors.slug}</p>
      )}
      {autoGenerate ? (
        <p className="text-xs text-muted-foreground">
          Backend จะสุ่มลิงก์ URL ให้หลังจากบันทึก
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          ตัวอย่างลิงก์:{' '}
          <span className="break-all font-mono text-foreground">
            {siteUrl}/content/{previewSlug}
          </span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        ใช้เป็นส่วนหนึ่งของลิงก์และต้องไม่ซ้ำกับเนื้อหาอื่น
      </p>
    </div>
  )
}
