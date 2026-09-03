'use client'

import { useState } from 'react'
import { GenreSelect } from '@/components/common/genre-select'
import { useCreateStoryForm } from './create-story-form'

interface StoryGenreFieldsProps {
  initialPrimaryGenreId?: string
  initialSecondaryGenreId?: string
}

export function StoryGenreFields({
  initialPrimaryGenreId = '',
  initialSecondaryGenreId = '',
}: StoryGenreFieldsProps) {
  const { clearFieldError, errors } = useCreateStoryForm()
  const [primaryGenreId, setPrimaryGenreId] = useState(initialPrimaryGenreId)
  const [secondaryGenreId, setSecondaryGenreId] = useState(initialSecondaryGenreId)

  return (
    <>
      <GenreSelect
        id="primary-genre"
        name="primary_genre_id"
        label="หมวดหมู่หลัก"
        value={primaryGenreId}
        onValueChange={(value) => {
          setPrimaryGenreId(value)
          clearFieldError('primary_genre_id')
        }}
        excludedValues={secondaryGenreId ? [secondaryGenreId] : []}
        error={errors.primary_genre_id}
        required
      />
      <GenreSelect
        id="secondary-genre"
        name="secondary_genre_id"
        label="หมวดหมู่รอง"
        value={secondaryGenreId}
        onValueChange={(value) => {
          setSecondaryGenreId(value)
          clearFieldError('secondary_genre_id')
        }}
        excludedValues={primaryGenreId ? [primaryGenreId] : []}
        error={errors.secondary_genre_id}
      />
    </>
  )
}
