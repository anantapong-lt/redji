import { cache } from '../../cache'
import { db } from '../../db'

export interface GenreOption {
  value: string
  label: string
  slug: string
}

const GENRE_OPTIONS_CACHE_KEY = 'genre-options:all'
const GENRE_OPTIONS_CACHE_TTL_SECONDS = 24 * 60 * 60

function isGenreOption(value: unknown): value is GenreOption {
  if (!value || typeof value !== 'object') return false

  const option = value as Record<string, unknown>
  return typeof option.value === 'string'
    && typeof option.label === 'string'
    && typeof option.slug === 'string'
}

function parseCachedGenreOptions(value: string): GenreOption[] | null {
  try {
    const options: unknown = JSON.parse(value)
    return Array.isArray(options) && options.every(isGenreOption) ? options : null
  } catch {
    return null
  }
}

export async function getGenreOptions(): Promise<GenreOption[]> {
  let cacheAvailable = false
  try {
    if (!cache.connected) await cache.connect()
    const cachedOptions = await cache.get(GENRE_OPTIONS_CACHE_KEY)
    cacheAvailable = true
    if (cachedOptions) {
      const options = parseCachedGenreOptions(cachedOptions)
      if (options) return options
    }
  } catch (error) {
    console.error('Unable to read genre options from Redis', error)
  }

  const options = await db<GenreOption[]>`
    SELECT id::TEXT AS value, name AS label, slug
    FROM genres
    ORDER BY name ASC
  `

  if (!cacheAvailable) return options

  try {
    await cache.send('SET', [
      GENRE_OPTIONS_CACHE_KEY,
      JSON.stringify(options),
      'EX',
      String(GENRE_OPTIONS_CACHE_TTL_SECONDS),
    ])
  } catch (error) {
    console.error('Unable to cache genre options in Redis', error)
  }

  return options
}
