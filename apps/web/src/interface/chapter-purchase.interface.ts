export interface ChapterPurchase {
  id: string
  chapter_id: string
  price: string
  writer_revenue: string
  platform_revenue: string
  purchased_at: string
}

export interface ChapterPurchaseResponse {
  purchase: ChapterPurchase
}

export interface BulkChapterPurchaseResponse {
  purchases: ChapterPurchase[]
}
