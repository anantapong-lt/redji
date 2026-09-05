import { db } from '../../../db'

interface WriterPurchase {
  id: string
  story_title: string
  cover_url: string | null
  chapter_number: string
  chapter_title: string
  price: string
  buyer_username: string
  buyer_avatar_url: string | null
  purchased_at: Date
}

export async function countWriterPurchases(userId: string, search: string): Promise<number> {
  const [row] = await db<{ total: string }[]>`
    SELECT COUNT(*)::TEXT AS total
    FROM chapter_purchases cp
    JOIN chapters ON chapters.id = cp.chapter_id
    JOIN stories ON stories.id = chapters.story_id
    JOIN users buyer ON buyer.id = cp.buyer_user_id
    WHERE stories.creator_user_id = ${userId}
      AND stories.deleted_at IS NULL
      AND (
        ${search} = ''
        OR STRPOS(LOWER(buyer.username), LOWER(${search})) > 0
        OR STRPOS(LOWER(stories.title), LOWER(${search})) > 0
      )
  `
  return Number(row?.total ?? 0)
}

export async function findWriterPurchases(userId: string, page: number, limit: number, search: string) {
  return db<WriterPurchase[]>`
    SELECT cp.id, stories.title AS story_title, stories.cover_url,
      chapters.chapter_number::TEXT, chapters.title AS chapter_title,
      cp.price::TEXT, buyer.username AS buyer_username,
      buyer.avatar_url AS buyer_avatar_url, cp.purchased_at
    FROM chapter_purchases cp
    JOIN chapters ON chapters.id = cp.chapter_id
    JOIN stories ON stories.id = chapters.story_id
    JOIN users buyer ON buyer.id = cp.buyer_user_id
    WHERE stories.creator_user_id = ${userId}
      AND stories.deleted_at IS NULL
      AND (
        ${search} = ''
        OR STRPOS(LOWER(buyer.username), LOWER(${search})) > 0
        OR STRPOS(LOWER(stories.title), LOWER(${search})) > 0
      )
    ORDER BY cp.purchased_at DESC, cp.id DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `
}
