'use client'

import { useState, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { STORY_STATUS_OPTIONS, StoryStatus } from '@/constants/story.constant'
import { useCreateStoryForm } from './create-story-form'

interface StoryMetadataFieldsProps {
  contentLabel: string
  initialTitle: string
  children: ReactNode
}

export function StoryMetadataFields({
  children,
  contentLabel,
  initialTitle,
}: StoryMetadataFieldsProps) {
  const { clearFieldError, errors } = useCreateStoryForm()
  const [title, setTitle] = useState(initialTitle)
  const [status, setStatus] = useState<StoryStatus>(StoryStatus.DRAFT)
  const [ageRating, setAgeRating] = useState('')

  return (
    <>
      <div className="space-y-2 md:col-span-2" data-field="title">
        <Label htmlFor="title" className="text-sm font-semibold">
          ชื่อ{contentLabel} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          type="text"
          name="title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            clearFieldError('title')
          }}
          maxLength={255}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'title-error' : undefined}
          placeholder={`กรอกชื่อ${contentLabel}`}
          className="h-11 rounded-xl px-3"
        />
        {errors.title && (
          <p id="title-error" className="text-xs text-destructive">{errors.title}</p>
        )}
      </div>

      {children}

      <div className="space-y-2" data-field="status">
        <Label htmlFor="status" className="text-sm font-semibold">
          สถานะ <span className="text-destructive">*</span>
        </Label>
        <Select
          name="status"
          value={status}
          onValueChange={(value) => {
            setStatus(value as StoryStatus)
            clearFieldError('status')
          }}
        >
          <SelectTrigger
            id="status"
            className="h-11! w-full rounded-xl px-3"
            aria-invalid={Boolean(errors.status)}
            aria-describedby={errors.status ? 'status-error' : undefined}
          >
            <SelectValue placeholder="เลือกสถานะ" />
          </SelectTrigger>
          <SelectContent>
            {STORY_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.status && (
          <p id="status-error" className="text-xs text-destructive">{errors.status}</p>
        )}
      </div>

      <div className="space-y-2" data-field="age_rating">
        <Label htmlFor="age-rating" className="text-sm font-semibold">เรทอายุ</Label>
        <Input
          id="age-rating"
          type="number"
          name="age_rating"
          value={ageRating}
          onChange={(event) => {
            setAgeRating(event.target.value)
            clearFieldError('age_rating')
          }}
          min={0}
          max={32767}
          step={1}
          aria-invalid={Boolean(errors.age_rating)}
          aria-describedby={errors.age_rating ? 'age-rating-error' : undefined}
          placeholder="ตัวอย่าง: 13"
          className="h-11 rounded-xl px-3"
        />
        {errors.age_rating && (
          <p id="age-rating-error" className="text-xs text-destructive">{errors.age_rating}</p>
        )}
      </div>
    </>
  )
}
