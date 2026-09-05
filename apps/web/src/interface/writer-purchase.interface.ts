export interface WriterPurchasesResponse {
  purchases: {
    id: string
    story_title: string
    cover_url: string | null
    chapter_number: string
    chapter_title: string
    price: string
    buyer_username: string
    buyer_avatar_url: string | null
    purchased_at: string
  }[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
