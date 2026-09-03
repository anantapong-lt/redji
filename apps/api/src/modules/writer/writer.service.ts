import { db } from '../../db'

export interface WriterStats {
  story_count: string
  chapter_count: string
  total_views: string
  favorite_count: string
  free_chapter_count: string
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
      )::TEXT AS free_chapter_count
  `

  return stats
}
