'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SITE_CONFIG } from '@/site.config'

export function SlugField() {
  const [slug, setSlug] = useState('')
  const previewSlug = slug.trim() || 'your-story-slug'
  const siteUrl = SITE_CONFIG.siteUrl.replace(/\/$/, '')

  return (
    <div className="space-y-2 md:col-span-2">
      <Label htmlFor="slug" className="text-sm font-semibold">
        ลิงก์ URL<span className="text-destructive">*</span>
      </Label>
      <Input
        id="slug"
        type="text"
        name="slug"
        value={slug}
        onChange={(event) => setSlug(event.target.value)}
        maxLength={255}
        required
        placeholder="ตัวอย่าง: my-story-title"
        className="h-11 rounded-xl px-3"
      />
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
