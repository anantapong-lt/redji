export type ReadingTheme = 'light' | 'sepia' | 'dark'

export interface ReadingSettings {
  fontSize: number // px
  lineHeight: number // unitless multiplier
  fontFamily: 'serif' | 'sans' | 'handwriting'
  theme: ReadingTheme
}

export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  fontSize: 22,
  lineHeight: 1.9,
  fontFamily: 'serif',
  theme: 'light',
}

// background/text ของแต่ละธีม — background: null หมายถึงใช้สีเดิมของเว็บ (bg-card/text-foreground)
// ไม่ override เลย (ธีม "สว่าง" ที่เป็น default เดิมของหน้าอ่าน) ใช้ร่วมกันทั้งตัวเลือกใน
// reading-settings-popover.tsx (swatch) และตัวใส่จริงใน episode-content-reader.tsx (สี
// เนื้อหาจริง) กันสีเพี้ยนกันระหว่าง 2 จุด — "dark" ตั้งใจไม่ใช่สีดำ (user บอกเป็นสีดำที่ค้างไว้
// จากตอนยังเป็น mock) เปลี่ยนเป็นเขียวกระดานดำ+ตัวหนังสือขาวแทน
export const READING_THEMES: Record<ReadingTheme, { label: string; background: string | null; text: string | null }> = {
  light: { label: 'สว่าง', background: null, text: null },
  sepia: { label: 'ครีม', background: '#f5e9d3', text: '#54252b' },
  dark: { label: 'กระดานดำ', background: '#1e3d32', text: '#f5f5f0' },
}

export const FONT_SIZE_MIN = 16
export const FONT_SIZE_MAX = 32
export const FONT_SIZE_STEP = 2

export const LINE_HEIGHT_MIN = 1.4
export const LINE_HEIGHT_MAX = 2.4
export const LINE_HEIGHT_STEP = 0.1

// เก็บไว้ในเครื่องเท่านั้น (localStorage) — ยังไม่ผูกกับ user account
// ข้ามอุปกรณ์/ข้าม browser ไม่ได้ ถ้าจะทำแบบนั้นต้องเก็บลง backend แทน (ดู KNOWN_ISSUES.md)
const STORAGE_KEY = 'readji:reading-settings'

export function loadReadingSettings(): ReadingSettings {
  if (typeof window === 'undefined') return DEFAULT_READING_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_READING_SETTINGS
    return { ...DEFAULT_READING_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_READING_SETTINGS
  }
}

export function saveReadingSettings(settings: ReadingSettings) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // เต็ม quota หรือ private browsing บล็อกไว้ — ปล่อยผ่าน ไม่ critical
  }
}
