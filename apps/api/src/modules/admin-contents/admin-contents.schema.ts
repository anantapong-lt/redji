import { t } from 'elysia'
import { STORY_STATUSES, STORY_TYPES } from '../../models/story.model'

export const adminContentsQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  search: t.Optional(t.String({ maxLength: 255 })),
  type: t.Optional(t.UnionEnum(STORY_TYPES)),
  status: t.Optional(t.UnionEnum(STORY_STATUSES)),
  genre_id: t.Optional(t.String({ format: 'uuid' })),
})
