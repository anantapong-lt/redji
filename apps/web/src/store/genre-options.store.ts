'use client'

import { create } from 'zustand'
import { getGenreOptions } from '@/controllers/genre.controller'
import type { GenreOption } from '@/interface/genre-option.interface'

type GenreOptionsStatus = 'idle' | 'loading' | 'success' | 'error'

interface GenreOptionsState {
  options: GenreOption[]
  status: GenreOptionsStatus
  error: string | null
  loadOptions: () => Promise<void>
}

export const useGenreOptionsStore = create<GenreOptionsState>((set, get) => ({
  options: [],
  status: 'idle',
  error: null,
  loadOptions: async () => {
    const { status } = get()
    if (status === 'loading' || status === 'success') return

    set({ status: 'loading', error: null })

    try {
      const { options } = await getGenreOptions()
      set({ options, status: 'success' })
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unable to load genre options',
      })
    }
  },
}))
