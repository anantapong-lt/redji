import { db } from '../../db'
import { uploadPublicCover } from '../writer/content/writer-cover.service'
import type { StoryStatus, StoryType } from '../../models/story.model'
import type { UserRole } from '../../models/user.model'

export interface ProfileSocialLinks {
  facebook?: string
  instagram?: string
  x?: string
  tiktok?: string
  youtube?: string
  website?: string
}

export interface ProfileStory {
  id: string
  title: string
  slug: string
  cover_url: string | null
  cover_blur_data_url: string | null
  type: StoryType
  status: StoryStatus
  rating_average: string
  chapter_count: string
  latest_chapter: { chapter_number: string } | null
}

export interface PublicProfile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  profile_cover_url: string | null
  role: UserRole
  bio: string | null
  social_links: ProfileSocialLinks
  created_at: Date
  stories: ProfileStory[]
  pagination: { page: number; limit: number; has_next_page: boolean }
}

export async function findPublicProfileByUsername(username: string, type: StoryType = 'novel', page = 1, limit = 12): Promise<PublicProfile | undefined> {
  const offset = (page - 1) * limit
  const [profile] = await db<Omit<PublicProfile, 'stories' | 'pagination'>[]>`
    SELECT id, username, display_name, avatar_url, profile_cover_url, role, bio, social_links, created_at
    FROM users
    WHERE LOWER(username) = LOWER(${username})
      AND status = 'active'
      AND deleted_at IS NULL
    LIMIT 1
  `
  if (!profile) return undefined

  const authoredStories = await db<ProfileStory[]>`
    SELECT
      stories.id, stories.title, stories.slug, stories.cover_url, stories.cover_blur_data_url,
      stories.type, stories.status,
      COALESCE(ratings.rating_average, '0.0') AS rating_average,
      chapters.chapter_count,
      chapters.latest_chapter
    FROM stories
    INNER JOIN LATERAL (
      SELECT
        COUNT(*)::TEXT AS chapter_count,
        json_build_object('chapter_number', MAX(chapter_number)::TEXT) AS latest_chapter
      FROM chapters
      WHERE chapters.story_id = stories.id
        AND chapters.status = 'published'
        AND chapters.published_at <= NOW()
    ) AS chapters ON chapters.chapter_count <> '0'
    LEFT JOIN LATERAL (
      SELECT ROUND(AVG(rating)::NUMERIC, 1)::TEXT AS rating_average
      FROM story_ratings
      WHERE story_id = stories.id
    ) AS ratings ON TRUE
    WHERE stories.creator_user_id = ${profile.id}
      AND stories.status IN ('ongoing', 'completed')
      AND stories.deleted_at IS NULL
      AND stories.type = ${type}
    ORDER BY stories.updated_at DESC, stories.id DESC
    LIMIT ${limit + 1} OFFSET ${offset}
  `

  const stories = profile.role === 'writer'
    ? authoredStories
    : await db<ProfileStory[]>`
      SELECT
        stories.id, stories.title, stories.slug, stories.cover_url, stories.cover_blur_data_url,
        stories.type, stories.status,
        COALESCE(ratings.rating_average, '0.0') AS rating_average,
        chapters.chapter_count,
        chapters.latest_chapter
      FROM story_favorites
      INNER JOIN stories ON stories.id = story_favorites.story_id
      INNER JOIN LATERAL (
        SELECT
          COUNT(*)::TEXT AS chapter_count,
          json_build_object('chapter_number', MAX(chapter_number)::TEXT) AS latest_chapter
        FROM chapters
        WHERE chapters.story_id = stories.id
          AND chapters.status = 'published'
          AND chapters.published_at <= NOW()
      ) AS chapters ON chapters.chapter_count <> '0'
      LEFT JOIN LATERAL (
        SELECT ROUND(AVG(rating)::NUMERIC, 1)::TEXT AS rating_average
        FROM story_ratings
        WHERE story_id = stories.id
      ) AS ratings ON TRUE
      WHERE story_favorites.user_id = ${profile.id}
        AND stories.status IN ('ongoing', 'completed')
        AND stories.deleted_at IS NULL
        AND stories.type = ${type}
      ORDER BY story_favorites.created_at DESC
      LIMIT ${limit + 1} OFFSET ${offset}
    `

  return {
    ...profile,
    stories: stories.slice(0, limit),
    pagination: { page, limit, has_next_page: stories.length > limit },
  }
}

export async function findMyProfile(userId: string): Promise<PublicProfile | undefined> {
  const [profile] = await db<Omit<PublicProfile, 'stories' | 'pagination'>[]>`
    SELECT id, username, display_name, avatar_url, profile_cover_url, role, bio, social_links, created_at
    FROM users
    WHERE id = ${userId} AND deleted_at IS NULL
    LIMIT 1
  `
  if (!profile) return undefined

  const stories = profile.role === 'writer'
    ? await findPublicProfileByUsername(profile.username).then((result) => result?.stories ?? [])
    : await db<ProfileStory[]>`
      SELECT
        stories.id, stories.title, stories.slug, stories.cover_url, stories.cover_blur_data_url,
        stories.type, stories.status,
        COALESCE(ratings.rating_average, '0.0') AS rating_average,
        chapters.chapter_count,
        chapters.latest_chapter
      FROM story_favorites
      INNER JOIN stories ON stories.id = story_favorites.story_id
      INNER JOIN LATERAL (
        SELECT
          COUNT(*)::TEXT AS chapter_count,
          json_build_object('chapter_number', MAX(chapter_number)::TEXT) AS latest_chapter
        FROM chapters
        WHERE chapters.story_id = stories.id
          AND chapters.status = 'published'
          AND chapters.published_at <= NOW()
      ) AS chapters ON chapters.chapter_count <> '0'
      LEFT JOIN LATERAL (
        SELECT ROUND(AVG(rating)::NUMERIC, 1)::TEXT AS rating_average
        FROM story_ratings
        WHERE story_id = stories.id
      ) AS ratings ON TRUE
      WHERE story_favorites.user_id = ${userId}
        AND stories.status IN ('ongoing', 'completed')
        AND stories.deleted_at IS NULL
      ORDER BY story_favorites.created_at DESC
    `

  return { ...profile, stories, pagination: { page: 1, limit: stories.length, has_next_page: false } }
}

export async function updateMyProfile(
  userId: string,
  input: { bio?: string | null; social_links?: ProfileSocialLinks },
): Promise<PublicProfile | undefined> {
  const bio = input.bio === undefined ? undefined : input.bio?.trim() || null
  const socialLinks = input.social_links === undefined
    ? undefined
    : Object.fromEntries(Object.entries(input.social_links)
      .map(([key, value]) => [key, value?.trim()])
      .filter(([, value]) => Boolean(value)))

  if (input.bio !== undefined) {
    await db`
      UPDATE users SET bio = ${bio}, updated_at = NOW()
      WHERE id = ${userId} AND deleted_at IS NULL
    `
  }
  if (input.social_links !== undefined) {
    await db`
      UPDATE users SET social_links = ${JSON.stringify(socialLinks)}::JSONB, updated_at = NOW()
      WHERE id = ${userId} AND deleted_at IS NULL
    `
  }

  return findMyProfile(userId)
}

export async function updateMyProfileCover(userId: string, cover: File): Promise<PublicProfile | undefined> {
  const uploadedCover = await uploadPublicCover(cover, 'profiles/covers', {
    width: 1600,
    height: 900,
    quality: 82,
  })

  await db`
    UPDATE users SET profile_cover_url = ${uploadedCover.cover_url}, updated_at = NOW()
    WHERE id = ${userId} AND deleted_at IS NULL
  `

  return findMyProfile(userId)
}
