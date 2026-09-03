import type { ChapterStatus } from './story.model'

export interface GetWriterChaptersInput {
  search?: string
  page: number
  limit: number
}

export interface WriterChapter {
  id: string
  chapter_number: string
  title: string
  price: string
  is_free: boolean
  sales_count: string
  status: ChapterStatus
  published_at: Date | null
  created_at: Date
}

export interface WriterChapterCount {
  total: string
}

export interface WriterChaptersResult {
  chapters: WriterChapter[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface BulkUpdateChapterPriceInput {
  chapter_ids: string[]
  price: number
}

export interface BulkUpdateChapterStatusInput {
  chapter_ids: string[]
  status: ChapterStatus
  published_at?: string
}
