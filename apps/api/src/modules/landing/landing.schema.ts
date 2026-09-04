import { t } from 'elysia'

export const LANDING_SECTIONS = ['latest', 'popular', 'weekly', 'all-time'] as const

export type LandingSection = (typeof LANDING_SECTIONS)[number]

export const landingQuerySchema = t.Object({
  section: t.UnionEnum(LANDING_SECTIONS),
  page: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
})
