export interface ChapterPurchase {
  id: string
  chapter_id: string
  price: string
  purchased_at: string
}

export interface ChapterPurchaseResponse {
  purchase: ChapterPurchase
}

export interface BulkChapterPurchaseResponse {
  purchases: ChapterPurchase[]
}

export interface UserChapterPurchase {
  id: string
  story_title: string
  story_slug: string
  cover_url: string | null
  chapter_number: string
  chapter_title: string
  price: string
  purchased_at: string
}

export interface ChapterPurchaseHistoryResponse {
  purchases: UserChapterPurchase[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
