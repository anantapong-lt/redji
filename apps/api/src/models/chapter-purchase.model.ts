export interface PurchasableChapter {
  id: string
  is_free: boolean
  price: string
  writer_user_id: string
}

export interface PurchaseAccount {
  id: string
  balance: string
  status: string
  deleted_at: Date | null
}

export interface ExistingChapterPurchase {
  id: string
}

export interface ChapterPurchase {
  id: string
  chapter_id: string
  price: string
  writer_revenue: string
  platform_revenue: string
  purchased_at: Date
}
