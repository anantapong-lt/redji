'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { STORY_SYNOPSIS_MAX_LENGTH } from '@/constants/story.constant'
import { useCreateStoryForm } from './create-story-form'

interface SynopsisFieldProps {
  contentLabel: string
  initialSynopsis?: string
}

export function SynopsisField({ contentLabel, initialSynopsis = '' }: SynopsisFieldProps) {
  const { clearFieldError, errors } = useCreateStoryForm()
  const [synopsis, setSynopsis] = useState(initialSynopsis)

  return (
    <div className="space-y-2 md:col-span-2" data-field="synopsis">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="synopsis" className="text-sm font-semibold">เรื่องย่อ</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {synopsis.length}/{STORY_SYNOPSIS_MAX_LENGTH}
        </span>
      </div>
      <Textarea
        id="synopsis"
        name="synopsis"
        value={synopsis}
        onChange={(event) => {
          setSynopsis(event.target.value)
          clearFieldError('synopsis')
        }}
        maxLength={STORY_SYNOPSIS_MAX_LENGTH}
        rows={6}
        aria-invalid={Boolean(errors.synopsis)}
        aria-describedby={errors.synopsis ? 'synopsis-error' : undefined}
        placeholder={`เขียนเรื่องย่อของ${contentLabel}`}
        className="min-h-36 resize-y rounded-xl px-3 py-3"
      />
      {errors.synopsis && (
        <p id="synopsis-error" className="text-xs text-destructive">{errors.synopsis}</p>
      )}
    </div>
  )
}
