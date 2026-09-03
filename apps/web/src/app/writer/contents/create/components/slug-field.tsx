'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { STORY_SLUG_MAX_LENGTH } from '@/constants/story.constant'
import { SITE_CONFIG } from '@/site.config'
import { useCreateStoryForm } from './create-story-form'

export function SlugField() {
  const { clearFieldError, errors } = useCreateStoryForm()
  const [slug, setSlug] = useState('')
  const previewSlug = slug.trim() || 'your-story-slug'
  const siteUrl = SITE_CONFIG.siteUrl.replace(/\/$/, '')

  return (
    <div className="space-y-2 md:col-span-2" data-field="slug">
      <Label htmlFor="slug" className="text-sm font-semibold">
        ลิงก์ URL<span className="text-destructive">*</span>
      </Label>
      <Input
        id="slug"
        type="text"
        name="slug"
        value={slug}
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
      <p className="text-xs text-muted-foreground">
        ตัวอย่างลิงก์:{' '}
        <span className="break-all font-mono text-foreground">
          {siteUrl}/content/{previewSlug}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        ใช้เป็นส่วนหนึ่งของลิงก์และต้องไม่ซ้ำกับเนื้อหาอื่น
      </p>
    </div>
  )
}
