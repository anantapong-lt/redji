import { db } from '../../db'
import { USER_ROLE } from '../../models/user.model'

export interface AdminPurchase {
  id: string
  story_title: string
  story_slug: string
  cover_url: string | null
  chapter_number: string
  chapter_title: string
  price: string
  buyer_display_name: string
  buyer_username: string
  buyer_avatar_url: string | null
  writer_display_name: string
  writer_username: string
  writer_avatar_url: string | null
  purchased_at: Date
}

export interface AdminPurchaseStory {
  id: string
  title: string
}

export interface AdminPurchaseUser {
  id: string
  display_name: string
  username: string
  avatar_url: string | null
}

function purchaseFilters(storyId: string | null, userIds: string[], dateFrom: string | null, dateTo: string | null) {
  return {
    storyId,
    userIds,
    dateFrom,
    dateTo,
  }
}

export async function countAdminPurchases(storyId: string | null, userIds: string[], dateFrom: string | null, dateTo: string | null) {
  const filters = purchaseFilters(storyId, userIds, dateFrom, dateTo)
  const userIdArray = db.array(filters.userIds, 'UUID')
  const [row] = await db<{ total: string }[]>`
    SELECT COUNT(*)::TEXT AS total
    FROM chapter_purchases
    JOIN chapters ON chapters.id = chapter_purchases.chapter_id
    JOIN stories ON stories.id = chapters.story_id
    WHERE (${filters.storyId}::UUID IS NULL OR stories.id = ${filters.storyId}::UUID)
      AND (
        ${filters.userIds.length} = 0
        OR chapter_purchases.buyer_user_id = ANY(${userIdArray})
      )
      AND (
        ${filters.dateFrom}::DATE IS NULL
        OR chapter_purchases.purchased_at >= (${filters.dateFrom}::DATE::TIMESTAMP AT TIME ZONE 'Asia/Bangkok')
      )
      AND (
        ${filters.dateTo}::DATE IS NULL
        OR chapter_purchases.purchased_at < (((${filters.dateTo}::DATE + 1)::TIMESTAMP) AT TIME ZONE 'Asia/Bangkok')
      )
  `
  return Number(row?.total ?? 0)
}

export function findAdminPurchases(
  page: number,
  limit: number,
  storyId: string | null,
  userIds: string[],
  dateFrom: string | null,
  dateTo: string | null,
) {
  const filters = purchaseFilters(storyId, userIds, dateFrom, dateTo)
  const userIdArray = db.array(filters.userIds, 'UUID')
  return db<AdminPurchase[]>`
    SELECT
      chapter_purchases.id,
      stories.title AS story_title,
      stories.slug AS story_slug,
      stories.cover_url,
      chapters.chapter_number::TEXT,
      chapters.title AS chapter_title,
      chapter_purchases.price::TEXT,
      buyers.display_name AS buyer_display_name,
      buyers.username AS buyer_username,
      buyers.avatar_url AS buyer_avatar_url,
      writers.display_name AS writer_display_name,
      writers.username AS writer_username,
      writers.avatar_url AS writer_avatar_url,
      chapter_purchases.purchased_at
    FROM chapter_purchases
    JOIN chapters ON chapters.id = chapter_purchases.chapter_id
    JOIN stories ON stories.id = chapters.story_id
    JOIN users AS buyers ON buyers.id = chapter_purchases.buyer_user_id
    JOIN users AS writers ON writers.id = chapter_purchases.writer_user_id
    WHERE (${filters.storyId}::UUID IS NULL OR stories.id = ${filters.storyId}::UUID)
      AND (
        ${filters.userIds.length} = 0
        OR chapter_purchases.buyer_user_id = ANY(${userIdArray})
      )
      AND (
        ${filters.dateFrom}::DATE IS NULL
        OR chapter_purchases.purchased_at >= (${filters.dateFrom}::DATE::TIMESTAMP AT TIME ZONE 'Asia/Bangkok')
      )
      AND (
        ${filters.dateTo}::DATE IS NULL
        OR chapter_purchases.purchased_at < (((${filters.dateTo}::DATE + 1)::TIMESTAMP) AT TIME ZONE 'Asia/Bangkok')
      )
    ORDER BY chapter_purchases.purchased_at DESC, chapter_purchases.id DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `
}

export async function findAdminPurchaseStories(search: string, page: number, limit: number) {
  const stories = await db<AdminPurchaseStory[]>`
    SELECT stories.id, stories.title
    FROM stories
    WHERE EXISTS (
      SELECT 1
      FROM chapters
      JOIN chapter_purchases ON chapter_purchases.chapter_id = chapters.id
      WHERE chapters.story_id = stories.id
    )
      AND (
        ${search} = ''
        OR STRPOS(LOWER(stories.title), LOWER(${search})) > 0
      )
    ORDER BY stories.title ASC, stories.id ASC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `

  return stories
}

export async function findAdminPurchaseUsers(search: string, page: number, limit: number) {
  return db<AdminPurchaseUser[]>`
    SELECT users.id, users.display_name, users.username, users.avatar_url
    FROM users
    WHERE users.role <> ${USER_ROLE.SUPER_ADMIN}
      AND users.deleted_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM chapter_purchases
        WHERE chapter_purchases.buyer_user_id = users.id
      )
      AND (
        ${search} = ''
        OR STRPOS(LOWER(users.display_name), LOWER(${search})) > 0
        OR STRPOS(LOWER(users.username), LOWER(${search})) > 0
      )
    ORDER BY users.display_name ASC, users.id ASC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `
}
