import { t } from 'elysia'

export const profileUsernameParamsSchema = t.Object({
  username: t.String({ minLength: 3, maxLength: 50 }),
})

export const profileStoriesQuerySchema = t.Object({
  type: t.Optional(t.Union([t.Literal('novel'), t.Literal('manga')])),
  page: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 24, multipleOf: 1 })),
})

export const profileSocialLinksSchema = t.Object({
  facebook: t.Optional(t.String({ maxLength: 2048, pattern: '^https?://' })),
  instagram: t.Optional(t.String({ maxLength: 2048, pattern: '^https?://' })),
  x: t.Optional(t.String({ maxLength: 2048, pattern: '^https?://' })),
  tiktok: t.Optional(t.String({ maxLength: 2048, pattern: '^https?://' })),
  youtube: t.Optional(t.String({ maxLength: 2048, pattern: '^https?://' })),
  website: t.Optional(t.String({ maxLength: 2048, pattern: '^https?://' })),
})

export const updateMyProfileBodySchema = t.Object({
  bio: t.Optional(t.Union([t.String({ maxLength: 500 }), t.Null()])),
  social_links: t.Optional(profileSocialLinksSchema),
})

export const updateMyProfileCoverBodySchema = t.Object({
  cover: t.File({
    type: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: '5m',
  }),
})
