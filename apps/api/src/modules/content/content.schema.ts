import { t } from 'elysia'

export const contentParamsSchema = t.Object({
  slug: t.String({ minLength: 1, maxLength: 255 }),
})
