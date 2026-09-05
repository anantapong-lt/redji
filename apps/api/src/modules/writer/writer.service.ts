import { db } from '../../db'

export interface WriterStats {
  story_count: string
  chapter_count: string
  total_views: string
  favorite_count: string
  free_chapter_count: string
  gross_sales: string
  platform_revenue: string
  writer_revenue: string
  sales_count: string
}

export async function getWriterStats(userId: string): Promise<WriterStats> {
  const [stats] = await db<WriterStats[]>`
    SELECT
      (
        SELECT COUNT(*)
        FROM stories
        WHERE creator_user_id = ${userId}
          AND deleted_at IS NULL
      )::TEXT AS story_count,
      (
        SELECT COUNT(*)
        FROM chapters
        INNER JOIN stories ON stories.id = chapters.story_id
        WHERE stories.creator_user_id = ${userId}
          AND stories.deleted_at IS NULL
      )::TEXT AS chapter_count,
      (
        SELECT COALESCE(SUM(total_views), 0)
        FROM stories
        WHERE creator_user_id = ${userId}
          AND deleted_at IS NULL
      )::TEXT AS total_views,
      (
        SELECT COUNT(*)
        FROM story_favorites
        INNER JOIN stories ON stories.id = story_favorites.story_id
        WHERE stories.creator_user_id = ${userId}
          AND stories.deleted_at IS NULL
      )::TEXT AS favorite_count,
      (
        SELECT COUNT(*)
        FROM chapters
        INNER JOIN stories ON stories.id = chapters.story_id
        WHERE stories.creator_user_id = ${userId}
          AND stories.deleted_at IS NULL
          AND chapters.is_free = TRUE
      )::TEXT AS free_chapter_count,
      purchases.gross_sales,
      purchases.platform_revenue,
      purchases.writer_revenue,
      purchases.sales_count
    FROM (
      SELECT
        ROUND(COALESCE(SUM(price), 0), 2)::TEXT AS gross_sales,
        ROUND(COALESCE(SUM(platform_revenue), 0), 2)::TEXT AS platform_revenue,
        ROUND(COALESCE(SUM(writer_revenue), 0), 2)::TEXT AS writer_revenue,
        COUNT(*)::TEXT AS sales_count
      FROM chapter_purchases
      WHERE writer_user_id = ${userId}
    ) AS purchases
  `

  return stats
}
