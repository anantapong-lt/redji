import { t } from 'elysia'
import { ADMIN_CONTENT_STATUSES, MODERATION_STATUSES, STORY_TYPES } from '../../models/story.model'

export const adminContentsQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  search: t.Optional(t.String({ maxLength: 255 })),
  type: t.Optional(t.Union([t.Literal('all'), t.UnionEnum(STORY_TYPES)])),
  status: t.Optional(t.Union([t.Literal('all'), t.UnionEnum(MODERATION_STATUSES)])),
  genre_id: t.Optional(t.String({ format: 'uuid' })),
})

export const adminContentParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
})

export const adminContentStatusBodySchema = t.Object({
  status: t.UnionEnum(ADMIN_CONTENT_STATUSES),
  reason: t.Optional(t.String({ minLength: 1, maxLength: 1_000 })),
}, { additionalProperties: false })

// Kept for the deprecated delete endpoint handler until consumers have moved.
export const hideAdminContentBodySchema = t.Object({
  reason: t.String({ minLength: 1, maxLength: 1_000 }),
}, { additionalProperties: false })
