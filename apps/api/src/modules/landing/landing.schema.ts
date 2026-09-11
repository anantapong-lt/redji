import { t } from 'elysia'

export const LANDING_SECTIONS = ['random', 'latest', 'popular', 'weekly', 'all-time', 'most-followed'] as const
export const CONTENT_TYPES = ['novel', 'manga'] as const

export type LandingSection = (typeof LANDING_SECTIONS)[number]
export type ContentType = (typeof CONTENT_TYPES)[number]

export const landingQuerySchema = t.Object({
  section: t.UnionEnum(LANDING_SECTIONS),
  page: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
  category: t.Optional(t.String({ maxLength: 100 })),
  search: t.Optional(t.String({ maxLength: 255 })),
  type: t.Optional(t.UnionEnum(CONTENT_TYPES)),
})
