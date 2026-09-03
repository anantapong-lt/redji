'use client'

import { useState } from 'react'
import { GenreSelect } from '@/components/common/genre-select'

export function StoryGenreFields() {
  const [primaryGenreId, setPrimaryGenreId] = useState('')
  const [secondaryGenreId, setSecondaryGenreId] = useState('')

  return (
    <>
      <GenreSelect
        id="primary-genre"
        name="primary_genre_id"
        label="หมวดหมู่หลัก"
        value={primaryGenreId}
        onValueChange={setPrimaryGenreId}
        excludedValues={secondaryGenreId ? [secondaryGenreId] : []}
        required
      />
      <GenreSelect
        id="secondary-genre"
        name="secondary_genre_id"
        label="หมวดหมู่รอง"
        value={secondaryGenreId}
        onValueChange={setSecondaryGenreId}
        excludedValues={primaryGenreId ? [primaryGenreId] : []}
      />
    </>
  )
}
