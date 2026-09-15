import { t } from 'elysia'

export const googleAuthQuerySchema = t.Object(
  { next: t.Optional(t.String({ maxLength: 2048 })) },
  { additionalProperties: false },
)

export const googleCallbackQuerySchema = t.Object({
  code: t.Optional(t.String({ maxLength: 4096 })),
  state: t.Optional(t.String({ maxLength: 512 })),
  error: t.Optional(t.String({ maxLength: 256 })),
}, { additionalProperties: true })

export const loginBodySchema = t.Object(
  {
    email: t.String({ format: 'email', maxLength: 320 }),
    password: t.String({ minLength: 1, maxLength: 128 }),
    turnstile_token: t.Optional(t.String({ maxLength: 2048 })),
  },
  { additionalProperties: false },
)

export const registerBodySchema = t.Object(
  {
    username: t.String({ minLength: 3, maxLength: 30 }),
    email: t.String({ format: 'email', maxLength: 320 }),
    password: t.String({ minLength: 8, maxLength: 72 }),
    turnstile_token: t.Optional(t.String({ maxLength: 2048 })),
  },
  { additionalProperties: false },
)

export const verifyEmailBodySchema = t.Object(
  {
    token: t.String({ minLength: 1, maxLength: 200 }),
  },
  { additionalProperties: false },
)
