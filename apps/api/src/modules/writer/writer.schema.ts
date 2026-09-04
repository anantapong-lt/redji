import { t } from 'elysia'
import { CHAPTER_STATUSES, STORY_STATUSES, STORY_TYPES } from '../../models/story.model'

export const writerContentParamsSchema = t.Object({
  id: t.String({ format: 'uuid' }),
})

export const writerContentsQuerySchema = t.Object({
  tab: t.UnionEnum(['novel', 'cartoon']),
  page: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
})

export const createWriterContentBodySchema = t.Object({
  type: t.UnionEnum(STORY_TYPES),
  title: t.String({ minLength: 1, maxLength: 120 }),
  slug: t.Optional(t.String({ maxLength: 255 })),
  auto_generate_slug: t.Optional(t.Literal('true')),
  synopsis: t.Optional(t.String({ maxLength: 140 })),
  status: t.UnionEnum(STORY_STATUSES),
  age_rating: t.UnionEnum(['0', '18']),
  primary_genre_id: t.String({ format: 'uuid' }),
  secondary_genre_id: t.Optional(t.String()),
  cover: t.Optional(t.File({
    type: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: '5m',
  })),
})

export const updateWriterContentBodySchema = t.Object({
  type: t.UnionEnum(STORY_TYPES),
  title: t.String({ minLength: 1, maxLength: 120 }),
  slug: t.String({ minLength: 1, maxLength: 255 }),
  synopsis: t.Optional(t.String({ maxLength: 140 })),
  status: t.UnionEnum(STORY_STATUSES),
  age_rating: t.UnionEnum(['0', '18']),
  primary_genre_id: t.String({ format: 'uuid' }),
  secondary_genre_id: t.Optional(t.String()),
  cover: t.Optional(t.File({
    type: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: '5m',
  })),
  remove_cover: t.Optional(t.Literal('true')),
})

export const createWriterChapterBodySchema = t.Object({
  title: t.String({ minLength: 1, maxLength: 255 }),
  chapter_number: t.Numeric({ minimum: 0, maximum: 99_999_999.99 }),
  price: t.Numeric({ minimum: 0, maximum: 9_999_999_999.99 }),
  status: t.UnionEnum(CHAPTER_STATUSES),
  published_at: t.Optional(t.String({ format: 'date-time' })),
  content: t.Optional(t.String()),
  images: t.Optional(t.Files({
    type: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: '10m',
    maxItems: 100,
  })),
})

export const writerChaptersQuerySchema = t.Object({
  search: t.Optional(t.String({ maxLength: 255 })),
  page: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
})

export const bulkUpdateChapterPriceBodySchema = t.Object({
  chapter_ids: t.Array(t.String({ format: 'uuid' }), { minItems: 1 }),
  price: t.Number({ minimum: 0, maximum: 9_999_999_999.99 }),
})

export const bulkUpdateChapterStatusBodySchema = t.Object({
  chapter_ids: t.Array(t.String({ format: 'uuid' }), { minItems: 1 }),
  status: t.UnionEnum(CHAPTER_STATUSES),
  published_at: t.Optional(t.String({ format: 'date-time' })),
})
