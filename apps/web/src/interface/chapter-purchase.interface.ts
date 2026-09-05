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
