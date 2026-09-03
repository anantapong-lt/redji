import { t } from 'elysia'

export const loginBodySchema = t.Object(
  {
    email: t.String({ format: 'email', maxLength: 320 }),
    password: t.String({ minLength: 1, maxLength: 128 }),
  },
  { additionalProperties: false },
)
