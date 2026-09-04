export type ChapterStatus = 'draft' | 'scheduled' | 'published' | 'hidden'

export interface CreatedWriterChapter {
  id: string
  story_id: string
  story_type: 'novel' | 'manga'
  chapter_number: string
  title: string
  price: string
  is_free: boolean
  status: ChapterStatus
  published_at: string | null
  created_at: string
}

export interface WriterChapter {
  id: string
  chapter_number: string
  title: string
  price: string
  is_free: boolean
  sales_count: string
  status: ChapterStatus
  published_at: string | null
  created_at: string
}

export interface WriterChaptersResponse {
  chapters: WriterChapter[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
