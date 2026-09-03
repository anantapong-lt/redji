// =============================================================
// Novel Platform — Admin Contact Page Routes (2026-08-18, ใหม่)
// วางไว้ที่: apps/api/src/modules/admin/admin-contact-page.routes.ts
// =============================================================
//
// หน้า "ตั้งหน้าเว็บไซต์ > ช่องทางติดต่อ / FAQ" — gate แยกสิทธิ์กันเพราะเป็นเนื้อหาคนละส่วน
// (content.web_contacts.manage / content.faq.manage) แม้จะอยู่ไฟล์เดียวกัน — แยกเป็น 2 Elysia
// instance คนละ prefix (ไม่ใช้ .group() — ไม่มีที่ไหนในโค้ดฐานนี้ใช้ pattern นั้นเลย ตามแบบ
// authRoutes/authMeRoutes ที่แยก instance เวลาต้องการหลาย prefix ในโมดูลเดียวกัน)

import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { requirePermission, PERMISSION_DENIED_MESSAGE } from '../../lib/permission-guard'
import {
  getWebContactsAdmin, createWebContact, updateWebContact, deleteWebContact,
  getFaqsAdmin, createFaq, updateFaq, deleteFaq,
} from './admin-contact-page.service'

function handleError(err: any, set: any) {
  const map: Record<string, { status: number; message: string }> = {
    WEB_CONTACT_NOT_FOUND: { status: 404, message: 'ไม่พบช่องทางติดต่อนี้ (อาจถูกลบไปแล้ว)' },
    FAQ_NOT_FOUND:         { status: 404, message: 'ไม่พบคำถามนี้ (อาจถูกลบไปแล้ว)' },
  }
  const matched = map[err.message]
  if (matched) {
    set.status = matched.status
    return { success: false, message: matched.message }
  }
  throw err
}

// ---- ช่องทางติดต่อ ----
export const adminWebContactsRoutes = new Elysia({ prefix: '/admin/web-contacts' })
  .use(authMiddleware)

  .get('/', async ({ user, set }) => {
    if (!(await requirePermission(user, 'content.web_contacts.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await getWebContactsAdmin()
    return { success: true, data }
  }, {
    detail: { summary: 'รายการช่องทางติดต่อทั้งหมด', tags: ['Admin'] },
  })

  .post('/', async ({ user, body, set }) => {
    if (!(await requirePermission(user, 'content.web_contacts.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const result = await createWebContact(body)
    set.status = 201
    return { success: true, ...result }
  }, {
    body: t.Object({
      label:      t.String({ minLength: 1, maxLength: 100 }),
      url:        t.String({ minLength: 1, maxLength: 500 }),
      icon_class: t.Optional(t.Nullable(t.String({ maxLength: 50 }))),
      sort_order: t.Optional(t.Numeric()),
    }),
    detail: { summary: 'เพิ่มช่องทางติดต่อ', tags: ['Admin'] },
  })

  .patch('/:id', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'content.web_contacts.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await updateWebContact(BigInt(params.id), body)
      return { success: true }
    } catch (err: any) { return handleError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Object({
      label:      t.Optional(t.String({ minLength: 1, maxLength: 100 })),
      url:        t.Optional(t.String({ minLength: 1, maxLength: 500 })),
      icon_class: t.Optional(t.Nullable(t.String({ maxLength: 50 }))),
      sort_order: t.Optional(t.Numeric()),
      status:     t.Optional(t.Boolean()),
    }),
    detail: { summary: 'แก้ไขช่องทางติดต่อ', tags: ['Admin'] },
  })

  .delete('/:id', async ({ user, params, set }) => {
    if (!(await requirePermission(user, 'content.web_contacts.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await deleteWebContact(BigInt(params.id))
      return { success: true }
    } catch (err: any) { return handleError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'ลบช่องทางติดต่อถาวร', tags: ['Admin'] },
  })

// ---- คำถามที่พบบ่อย ----
export const adminFaqRoutes = new Elysia({ prefix: '/admin/faqs' })
  .use(authMiddleware)

  .get('/', async ({ user, set }) => {
    if (!(await requirePermission(user, 'content.faq.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await getFaqsAdmin()
    return { success: true, data }
  }, {
    detail: { summary: 'รายการ FAQ ทั้งหมด', tags: ['Admin'] },
  })

  .post('/', async ({ user, body, set }) => {
    if (!(await requirePermission(user, 'content.faq.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const result = await createFaq(body)
    set.status = 201
    return { success: true, ...result }
  }, {
    body: t.Object({
      question:   t.String({ minLength: 1, maxLength: 300 }),
      answer:     t.String({ minLength: 1, maxLength: 3000 }),
      sort_order: t.Optional(t.Numeric()),
    }),
    detail: { summary: 'เพิ่มคำถามที่พบบ่อย', tags: ['Admin'] },
  })

  .patch('/:id', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'content.faq.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await updateFaq(BigInt(params.id), body)
      return { success: true }
    } catch (err: any) { return handleError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Object({
      question:   t.Optional(t.String({ minLength: 1, maxLength: 300 })),
      answer:     t.Optional(t.String({ minLength: 1, maxLength: 3000 })),
      sort_order: t.Optional(t.Numeric()),
      status:     t.Optional(t.Boolean()),
    }),
    detail: { summary: 'แก้ไขคำถามที่พบบ่อย', tags: ['Admin'] },
  })

  .delete('/:id', async ({ user, params, set }) => {
    if (!(await requirePermission(user, 'content.faq.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await deleteFaq(BigInt(params.id))
      return { success: true }
    } catch (err: any) { return handleError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'ลบคำถามที่พบบ่อยถาวร', tags: ['Admin'] },
  })
