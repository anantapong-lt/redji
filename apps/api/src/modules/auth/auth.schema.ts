import { t } from 'elysia'

export const registerSchema = t.Object({
  u_name:       t.String({ minLength: 3, maxLength: 30 }),
  display_name: t.String({ minLength: 1, maxLength: 50 }),
  email:        t.String({ format: 'email' }),
  password:     t.String({ minLength: 8, maxLength: 72 }),
  ref_code:     t.Optional(t.String({ maxLength: 20 })),  // referral code (optional)
  // ⚠️ ห้ามรับ level, point, sales จาก user เด็ดขาด
})

export const loginSchema = t.Object({
  login:    t.String({ minLength: 1 }), // username หรือ email ก็ได้
  password: t.String({ minLength: 1 }),
})