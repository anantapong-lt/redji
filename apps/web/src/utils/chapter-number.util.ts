export function formatChapterNumber(value: string): string {
  return Number(value).toLocaleString('th-TH', { maximumFractionDigits: 1 })
}
