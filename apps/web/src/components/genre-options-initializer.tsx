'use client'

import { useEffect } from 'react'
import { useGenreOptionsStore } from '@/store/genre-options.store'

export function GenreOptionsInitializer() {
  const loadOptions = useGenreOptionsStore((state) => state.loadOptions)

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  return null
}
