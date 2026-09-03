import { apiRequest } from '@/lib/api-client'
import type { GenreOption } from '@/interface/genre-option.interface'

export function getGenreOptions(): Promise<{ options: GenreOption[] }> {
  return apiRequest<{ options: GenreOption[] }>('/genres-options')
}
