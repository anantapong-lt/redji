import type { ChapterStatus } from './writer-chapter.interface'

export interface ImportedChapter {
  id: string
  filename: string
  title: string
  chapter_number: string
  price: string
  status: ChapterStatus
  published_at: string
  content: string
  readError?: string
}

export interface ChapterImportResult {
  created_count: number
  errors: { index: number; message: string }[]
}
