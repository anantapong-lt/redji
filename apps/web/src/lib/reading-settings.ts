export type ReadingTheme = 'light' | 'sepia' | 'gray' | 'sage' | 'dark'

export interface ReadingSettings {
  fontSize: number
  fontFamily: 'sans' | 'serif'
  theme: ReadingTheme
}

export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  fontSize: 18,
  fontFamily: 'sans',
  theme: 'light',
}

export const READING_THEMES: Record<ReadingTheme, {
  label: string
  background: string
  text: string
}> = {
  light: {
    label: 'สว่าง',
    background: 'var(--card)',
    text: 'var(--foreground)',
  },
  sepia: {
    label: 'ครีม',
    background: 'var(--secondary)',
    text: 'var(--secondary-foreground)',
  },
  gray: {
    label: 'เทาอ่อน',
    background: '#e7e5e4',
    text: '#292524',
  },
  sage: {
    label: 'เขียวใบไม้',
    background: '#e5efe6',
    text: '#21352a',
  },
  dark: {
    label: 'มืด',
    background: '#000000',
    text: '#d1d5db',
  },
}

const STORAGE_KEY = 'readji:reading-settings'

export function loadReadingSettings(): ReadingSettings {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_READING_SETTINGS

    const parsed = JSON.parse(stored) as Partial<ReadingSettings>
    const fontSize = typeof parsed.fontSize === 'number'
      ? Math.min(32, Math.max(16, parsed.fontSize))
      : DEFAULT_READING_SETTINGS.fontSize
    const fontFamily = parsed.fontFamily === 'serif' ? 'serif' : 'sans'
    const theme = parsed.theme && parsed.theme in READING_THEMES
      ? parsed.theme
      : DEFAULT_READING_SETTINGS.theme

    return { fontSize, fontFamily, theme }
  } catch {
    return DEFAULT_READING_SETTINGS
  }
}

export function saveReadingSettings(settings: ReadingSettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Reading preferences are optional and can safely fall back to defaults.
  }
}
