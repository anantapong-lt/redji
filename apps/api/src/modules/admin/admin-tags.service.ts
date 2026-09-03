// =============================================================
// Novel Platform — Admin Tags (หมวดหมู่ย่อย) Service (2026-08-17, ใหม่)
// วางไว้ที่: apps/api/src/modules/admin/admin-tags.service.ts
// =============================================================
//
// เดิม tag (works.tags, free-text) ไม่มีหน้าแอดมินจัดการเลย แก้ได้แค่ผ่านฟอร์มเขียนนิยายทีละเรื่อง —
// หน้านี้ให้ดูภาพรวมทั้งหมด (จำนวนที่ใช้/ใช้ล่าสุดเมื่อไหร่/ยังมีใครใช้อยู่ไหม) + ถอด tag ออกจาก
// เรื่องใดเรื่องหนึ่ง หรือลบทิ้งถาวรจากทุกเรื่องพร้อมกันได้เลย
//
// ⚠️ works.tags (TEXT[] บนตาราง works) คือ source of truth จริงที่ใช้แสดงผล/ค้นหาทั่วเว็บ —
// ตาราง tags/work_tags (migration 017) เป็นแค่ "registry" คู่ขนานไว้นับสถิติ (สร้างจาก
// syncWorkTags() ใน writer.service.ts ตอนนักเขียน save งาน) อาจไม่ตรงกับ works.tags เป๊ะเสมอไป
// (เช่น cleanupStaleTags() ลบแถวใน tags ทิ้งได้โดยไม่แตะ works.tags เลย) — ฟังก์ชันในไฟล์นี้เลย:
//   - ใช้ registry (tags/work_tags) สำหรับ "ลิสต์ภาพรวม" (นับจำนวน/หาวันใช้ล่าสุด) เพราะเร็วกว่ามาก
//     ไม่ต้อง scan works.tags ทั้งตาราง
//   - ใช้ works.tags ตรงๆ (ไม่ผ่าน registry) สำหรับ "ใครใช้บ้าง" กับตอนถอน/ลบจริง เพราะเป็นข้อมูล
//     จริงที่มีผลต่อหน้าเว็บ ต้องแม่นกว่า registry

import { db } from '../../db'
import { sql } from 'kysely'

function toStr(val: bigint | null | undefined): string | null {
  return val === null || val === undefined ? null : String(val)
}

// ---- GET /admin/tags — ภาพรวม tag ทั้งหมดที่เคยมีคนใช้ (รวมที่ไม่มีใครใช้แล้วด้วย ไม่ใช่แค่ที่ active) ----
// นับจากงานที่ status='active' เท่านั้น (ไม่รวมที่ลบไปแล้ว) แต่รวมงานฉบับร่าง (publish_status=0)
// ด้วย — ต่างจาก GET /tags สาธารณะที่กรองเฉพาะเผยแพร่แล้วเท่านั้น (แอดมินต้องเห็นภาพรวมจริงกว่า)
export async function getTagsAdmin(page: number, limit: number) {
  const offset = (page - 1) * limit

  const rows = await db
    .selectFrom('tags as t')
    .leftJoin('work_tags as wt', 'wt.tag_id', 't.id')
    .leftJoin('works as w', (join) => join.onRef('w.p_id', '=', 'wt.p_id').on('w.status', '=', 'active'))
    .select(({ fn }) => [
      't.id',
      't.name',
      fn.count('w.p_id').distinct().as('work_count'),
      fn.max('wt.created_at').as('last_used_at'),
    ])
    .groupBy(['t.id', 't.name'])
    .orderBy('work_count', 'desc')
    .orderBy('t.name', 'asc')
    .limit(limit)
    .offset(offset)
    .execute()

  const totalRow = await db.selectFrom('tags').select(({ fn }) => fn.countAll<string>().as('total')).executeTakeFirstOrThrow()

  return {
    data: rows.map((r) => ({
      id: toStr(r.id)!,
      name: r.name,
      work_count: Number(r.work_count),
      last_used_at: r.last_used_at,
      // "ยังอยู่ไหม" ตามที่ user ระบุ — derive จากจำนวนงานที่ใช้จริงตอนนี้ (0 = แถว registry
      // ยังไม่ถูก cleanupStaleTags() เก็บกวาดแต่ไม่มีเรื่องไหนใช้จริงแล้ว)
      status: Number(r.work_count) > 0 ? ('active' as const) : ('unused' as const),
    })),
    pagination: { page, limit, total: Number(totalRow.total), pages: Math.ceil(Number(totalRow.total) / limit) },
  }
}

// ---- resolve tag id → name (ใช้ภายในไฟล์นี้เท่านั้น — route ฝั่งนอกใช้ id ล้วน กัน encode ปัญหา
// ชื่อ tag ที่มีอักขระพิเศษ/เครื่องหมาย / เป็นส่วนหนึ่งของ URL path) ----
async function resolveTagName(tagId: bigint): Promise<string> {
  const row = await db.selectFrom('tags').select('name').where('id', '=', tagId).executeTakeFirst()
  if (!row) throw new Error('TAG_NOT_FOUND')
  return row.name
}

// ---- GET /admin/tags/:id/works — เรื่องไหนใส่ tag นี้บ้าง (อ่านจาก works.tags ตรงๆ ไม่ผ่าน registry) ----
export async function getWorksForTag(tagId: bigint) {
  const tagName = await resolveTagName(tagId)
  const rows = await db
    .selectFrom('works as w')
    .innerJoin('users as author', 'author.id', 'w.author_id')
    .select(['w.p_id', 'w.uuid', 'w.title', 'w.cover_image', 'w.publish_status', 'author.display_name as author_name'])
    .where('w.status', '=', 'active')
    .where(sql<boolean>`${tagName} = ANY(w.tags)`)
    .orderBy('w.updated_at', 'desc')
    .execute()

  return rows.map((r) => ({
    p_id: toStr(r.p_id)!,
    uuid: r.uuid,
    title: r.title,
    cover_image: r.cover_image,
    is_published: r.publish_status === 1,
    author_name: r.author_name,
  }))
}

// ---- ถอด tag เดียวออกจากเรื่องเดียว — แก้ works.tags ตรงๆ + sync work_tags ให้ตรงกันเฉพาะแถวนี้ ----
export async function detachTagFromWork(pId: bigint, tagId: bigint) {
  const tagName = await resolveTagName(tagId)

  const work = await db.selectFrom('works').select('p_id').where('p_id', '=', pId).where('status', '=', 'active').executeTakeFirst()
  if (!work) throw new Error('WORK_NOT_FOUND')

  await db
    .updateTable('works')
    .set({ tags: sql`array_remove(tags, ${tagName})`, updated_at: new Date() })
    .where('p_id', '=', pId)
    .execute()

  await db.deleteFrom('work_tags').where('p_id', '=', pId).where('tag_id', '=', tagId).execute()
}

// ---- ลบ tag ทิ้งถาวรจากทุกเรื่องพร้อมกัน — คืนจำนวนเรื่องที่โดนถอดออกไปด้วย ----
export async function deleteTagEverywhere(tagId: bigint) {
  const tagName = await resolveTagName(tagId)

  const affected = await db
    .updateTable('works')
    .set({ tags: sql`array_remove(tags, ${tagName})`, updated_at: new Date() })
    .where(sql<boolean>`${tagName} = ANY(tags)`)
    .where('status', '=', 'active')
    .returning('p_id')
    .execute()

  // ลบจาก registry ด้วย (ON DELETE CASCADE พา work_tags ที่เหลือหายไปเองอัตโนมัติ)
  await db.deleteFrom('tags').where('id', '=', tagId).execute()

  return { affected_work_count: affected.length }
}
