// =============================================================
// Novel Platform — Admin Contact Page Service (2026-08-18, ใหม่)
// วางไว้ที่: apps/api/src/modules/admin/admin-contact-page.service.ts
// =============================================================
//
// หน้า "ตั้งหน้าเว็บไซต์ > ช่องทางติดต่อ / FAQ" — จัดการ 2 ตารางที่ใช้ประกอบหน้า "ติดต่อแอดมิน"
// ฝั่งผู้ใช้ (apps/web /contact-admin) และ web_contacts ยังใช้กับ Footer ด้วย (getWebContacts()
// ใน works.service.ts) ไม่มีอะไรอ้างอิง FK มาที่ตารางทั้งสองนี้เลย เลยลบถาวรได้ตรงๆ ไม่ต้องเช็ค
// FK-in-use แบบ categories

import { db } from '../../db'

function toStr(val: bigint | null | undefined): string | null {
  return val === null || val === undefined ? null : String(val)
}

// ---- ช่องทางติดต่อ (web_contacts) ----

export async function getWebContactsAdmin() {
  const rows = await db
    .selectFrom('web_contacts')
    .selectAll()
    .orderBy('sort_order', 'asc')
    .orderBy('id', 'asc')
    .execute()

  return rows.map((r) => ({
    id: toStr(r.id)!,
    label: r.label,
    url: r.url,
    icon_class: r.icon_class,
    sort_order: r.sort_order,
    status: r.status,
  }))
}

export async function createWebContact(input: { label: string; url: string; icon_class?: string | null; sort_order?: number }) {
  const row = await db
    .insertInto('web_contacts')
    .values({ label: input.label, url: input.url, icon_class: input.icon_class ?? null, sort_order: input.sort_order ?? 0, status: true })
    .returning(['id'])
    .executeTakeFirstOrThrow()
  return { id: toStr(row.id)! }
}

export async function updateWebContact(id: bigint, patch: { label?: string; url?: string; icon_class?: string | null; sort_order?: number; status?: boolean }) {
  const existing = await db.selectFrom('web_contacts').select('id').where('id', '=', id).executeTakeFirst()
  if (!existing) throw new Error('WEB_CONTACT_NOT_FOUND')

  await db.updateTable('web_contacts').set(patch).where('id', '=', id).execute()
}

export async function deleteWebContact(id: bigint) {
  const existing = await db.selectFrom('web_contacts').select('id').where('id', '=', id).executeTakeFirst()
  if (!existing) throw new Error('WEB_CONTACT_NOT_FOUND')

  await db.deleteFrom('web_contacts').where('id', '=', id).execute()
}

// ---- คำถามที่พบบ่อย (faqs) ----

export async function getFaqsAdmin() {
  const rows = await db
    .selectFrom('faqs')
    .selectAll()
    .orderBy('sort_order', 'asc')
    .orderBy('id', 'asc')
    .execute()

  return rows.map((r) => ({
    id: toStr(r.id)!,
    question: r.question,
    answer: r.answer,
    sort_order: r.sort_order,
    status: r.status,
  }))
}

export async function createFaq(input: { question: string; answer: string; sort_order?: number }) {
  const row = await db
    .insertInto('faqs')
    .values({ question: input.question, answer: input.answer, sort_order: input.sort_order ?? 0, status: true })
    .returning(['id'])
    .executeTakeFirstOrThrow()
  return { id: toStr(row.id)! }
}

export async function updateFaq(id: bigint, patch: { question?: string; answer?: string; sort_order?: number; status?: boolean }) {
  const existing = await db.selectFrom('faqs').select('id').where('id', '=', id).executeTakeFirst()
  if (!existing) throw new Error('FAQ_NOT_FOUND')

  await db.updateTable('faqs').set({ ...patch, updated_at: new Date() }).where('id', '=', id).execute()
}

export async function deleteFaq(id: bigint) {
  const existing = await db.selectFrom('faqs').select('id').where('id', '=', id).executeTakeFirst()
  if (!existing) throw new Error('FAQ_NOT_FOUND')

  await db.deleteFrom('faqs').where('id', '=', id).execute()
}
