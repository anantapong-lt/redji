import { Unzip, UnzipInflate } from 'fflate'
import type { ImportedChapter } from '@/interface/writer-chapter-import.interface'

export const CHAPTER_IMPORT_MAX_BYTES = 100 * 1024 * 1024

export async function readChapterZip(file: File): Promise<ImportedChapter[]> {
  if (!/\.zip$/i.test(file.name)) throw new Error('กรุณาเลือกไฟล์ ZIP')
  if (file.size > CHAPTER_IMPORT_MAX_BYTES) throw new Error('ไฟล์ ZIP ต้องมีขนาดไม่เกิน 100MB')
  const rows: ImportedChapter[] = []
  let total = 0
  let completed = 0
  const unzip = new Unzip((entry) => {
    if (entry.name.endsWith('/') || entry.name.startsWith('__MACOSX/') || entry.name.split('/').pop()?.startsWith('._')) return
    if (rows.length >= 500) throw new Error('นำเข้าได้สูงสุด 500 ตอน')
    const filename = entry.name.split(/[\\/]/).pop() ?? entry.name
    const title = filename.replace(/\.txt$/i, '')
    const row: ImportedChapter = {
      id: crypto.randomUUID(), filename, title,
      chapter_number: title.match(/\d+(?:\.\d+)?/)?.[0] ?? '',
      price: '0.00', status: 'published', published_at: '', content: '',
    }
    rows.push(row)
    if (!/\.txt$/i.test(filename)) {
      row.readError = 'รองรับเฉพาะไฟล์ .txt กรุณาลบรายการนี้'
      completed++
      return
    }
    const decoder = new TextDecoder('utf-8', { fatal: true })
    const parts: string[] = []
    entry.ondata = (error, data, final) => {
      if (error) {
        row.readError = 'ไม่สามารถแตกไฟล์นี้ได้: ' + error.message
        completed++
        return
      }
      total += data.length
      if (total > CHAPTER_IMPORT_MAX_BYTES) throw new Error('เนื้อหารวมหลังแตกไฟล์ต้องไม่เกิน 100MB')
      if (!row.readError) {
        try {
          parts.push(decoder.decode(data, { stream: !final }))
        } catch {
          row.readError = 'อ่านเนื้อหาไม่ได้ กรุณาบันทึก TXT เป็น UTF-8 แล้วนำเข้าใหม่'
        }
      }
      if (final) {
        row.content = row.readError ? '' : parts.join('')
        if (row.content.includes('\u0000')) row.readError = 'เนื้อหามีอักขระที่ไม่รองรับ กรุณาตรวจสอบไฟล์ TXT'
        completed++
      }
    }
    if (entry.compression !== 0 && entry.compression !== 8) {
      row.readError = 'รูปแบบการบีบอัดนี้ไม่รองรับ กรุณาสร้าง ZIP แบบปกติแล้วนำเข้าใหม่'
      completed++
      return
    }
    entry.start()
  })
  unzip.register(UnzipInflate)
  // Feed bounded chunks so expanded size is checked during decompression.
  for (let offset = 0; offset < file.size; offset += 16384) {
    const end = Math.min(offset + 16384, file.size)
    unzip.push(new Uint8Array(await file.slice(offset, end).arrayBuffer()), end === file.size)
  }
  if (!rows.length) throw new Error('ไม่พบไฟล์ตอนใน ZIP')
  if (completed !== rows.length) throw new Error('ไฟล์ ZIP ไม่สมบูรณ์ กรุณาตรวจสอบไฟล์แล้วนำเข้าใหม่')
  return rows.sort((a, b) => Number(a.chapter_number || Infinity) - Number(b.chapter_number || Infinity))
}

export function chapterImportErrors(rows: ImportedChapter[]): Record<string, string[]> {
  const counts = new Map<number, number>()
  for (const row of rows) counts.set(Number(row.chapter_number), (counts.get(Number(row.chapter_number)) ?? 0) + 1)
  return Object.fromEntries(rows.map((row) => {
    const errors: string[] = []
    if (row.readError) errors.push(row.readError)
    if (!row.title.trim() || row.title.length > 255) errors.push('ชื่อตอนต้องมี 1–255 ตัวอักษร')
    if (!/^\d+(\.\d{1,2})?$/.test(row.chapter_number) || Number(row.chapter_number) > 99_999_999.99) errors.push('กรุณาระบุเลขตอน 0–99,999,999.99 ทศนิยมไม่เกิน 2 ตำแหน่ง')
    else if ((counts.get(Number(row.chapter_number)) ?? 0) > 1) errors.push('เลขตอนซ้ำกับรายการอื่นที่นำเข้า')
    if (!/^\d+(\.\d{1,2})?$/.test(row.price) || Number(row.price) > 9_999_999_999.99) errors.push('ราคาไม่ถูกต้อง ต้องเป็น 0–9,999,999,999.99')
    if (!row.content.trim() && !row.readError) errors.push('เนื้อหาตอนว่างเปล่า')
    if (row.status === 'scheduled' && (!row.published_at || !Number.isFinite(new Date(row.published_at).getTime()) || new Date(row.published_at) <= new Date())) errors.push('กรุณาระบุเวลาเผยแพร่ในอนาคต')
    return [row.id, errors]
  }))
}
