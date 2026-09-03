import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** แปลง ISO date string เป็นรูปแบบไทยอ่านง่าย เช่น "30 ก.ค. 2569 14:30" */
export function formatThaiDateTime(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 10850 -> "10.85k", 1000 -> "1.00k", 999 -> "999".
 * Keep this for public-facing dashboard counts; financial approval records intentionally retain
 * their exact values so an administrator never approves a rounded amount by mistake.
 */
export function formatCompactNumber(value: number | string | bigint | null | undefined): string {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric)) return '—'

  const sign = numeric < 0 ? '-' : ''
  let scaled = Math.abs(numeric)
  const suffixes = ['', 'k', 'M', 'B', 'T']
  let suffixIndex = 0

  while (scaled >= 1000 && suffixIndex < suffixes.length - 1) {
    scaled /= 1000
    suffixIndex += 1
  }

  // 999,999 must become 1.00M instead of 1000.00k after rounding.
  if (Math.round(scaled * 100) >= 100_000 && suffixIndex < suffixes.length - 1) {
    scaled /= 1000
    suffixIndex += 1
  }

  if (suffixIndex === 0) return `${sign}${Math.round(scaled)}`
  return `${sign}${scaled.toFixed(2)}${suffixes[suffixIndex]}`
}
