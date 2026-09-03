import { t } from 'elysia'

export const updateProfileSchema = t.Object({
  display_name:     t.Optional(t.String({ minLength: 1, maxLength: 50 })),
  u_name:           t.Optional(t.String({ minLength: 3, maxLength: 30 })),
  bio:              t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
  social_media:     t.Optional(t.Object({
    facebook:  t.Optional(t.String()),
    twitter:   t.Optional(t.String()),
    instagram: t.Optional(t.String()),
  })),
  auto_ep_purchase: t.Optional(t.Boolean()),
  load_all_images:  t.Optional(t.Boolean()),
  bookmarks_public: t.Optional(t.Boolean()), // migration 022 — โชว์/ซ่อนแท็บบุ๊คมาร์คจากคนอื่น
  // ⚠️ ห้ามรับ level, point, sales, password_hash จาก user เด็ดขาด
})

// ---- PUT /users/me/social-links ---- (migration 019, สูงสุด 4 อัน เช็คจริงใน service)
export const socialLinksSchema = t.Object({
  links: t.Array(
    t.Object({
      url:   t.String({ minLength: 1, maxLength: 300 }),
      label: t.Optional(t.Nullable(t.String({ maxLength: 30 }))),
    }),
    { maxItems: 4 },
  ),
})
