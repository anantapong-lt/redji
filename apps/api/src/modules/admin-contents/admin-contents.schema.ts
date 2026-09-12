import { t } from 'elysia'
import { STORY_STATUSES, STORY_TYPES } from '../../models/story.model'

const ADMIN_CONTENT_VISIBILITIES = ['visible', 'hidden', 'all'] as const

export const adminContentsQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  search: t.Optional(t.String({ maxLength: 255 })),
  type: t.Optional(t.Union([t.Literal('all'), t.UnionEnum(STORY_TYPES)])),
  status: t.Optional(t.Union([t.Literal('all'), t.UnionEnum(STORY_STATUSES)])),
  visibility: t.Optional(t.UnionEnum(ADMIN_CONTENT_VISIBILITIES)),
  genre_id: t.Optional(t.String({ format: 'uuid' })),
})

export const adminContentParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
})
