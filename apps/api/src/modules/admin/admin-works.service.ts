// =============================================================
// Novel Platform — Admin Works Service (2026-08-04, ใหม่)
// วางไว้ที่: apps/api/src/modules/admin/admin-works.service.ts
// =============================================================
//
// แท็บ "ผลงาน" ในแอป admin — user ขอให้ "เหมือนกับ Writer เลย" คือแอดมิน (level >= 9) แก้ผลงาน
// ของนักเขียนคนไหนก็ได้เหมือนนักเขียนแก้ของตัวเอง (เนื้อหาตอน/รายละเอียดทุกอย่าง/สั่งเผยแพร่-ไม่
// เผยแพร่แม้เรื่องที่นักเขียนปิดไว้เอง) แทนที่จะเขียน service ใหม่ทั้งชุดซ้ำกับ writer.service.ts
// (ownership check เดียวกันทุกฟังก์ชัน คือ author_id = ผู้เรียก) ไฟล์นี้แค่ "แปลงร่าง" คำขอของแอดมิน
// เป็นคำขอของ "นักเขียนเจ้าของจริง" แล้ว delegate ไปเรียกฟังก์ชันเดิมของ writer.service.ts ตรงๆ —
// เพราะฟังก์ชันเดิมเช็คแค่ "userId ที่ส่งมาต้องตรงกับ author_id" เท่านั้น พอเราหา author_id ของ
// work/episode เป้าหมายมาก่อน แล้วส่ง author_id นั้นเข้าไปแทน adminId เงื่อนไขก็ผ่านเองโดยธรรมชาติ
// ได้สิทธิ์เท่านักเขียนเจ้าของงานจริงครบทุก field ไม่ต้อง duplicate logic เลย
//
// ทุก mutation เขียน audit log แยกต่างหาก (ต่างจาก log เดิมที่ writer.service.ts เขียนซึ่งจะลงชื่อ
// "author_id" เป็นผู้ทำ ไม่ใช่แอดมินจริง) ให้ตรงกับที่ user ขอไว้ตอนทำแท็บ "ประวัติ" ว่าต้องเห็นว่า
// "แอดมินคนไหนทำอะไรกับผลงานของใคร"
//
// Scope รอบนี้: ครบตามที่ user พูดชัดเจน (gallery/ค้นหา/กรอง, แก้รายละเอียดทั้งหมด, เนื้อหาตอน,
// สั่งเผยแพร่/ไม่เผยแพร่ทั้งระดับเรื่องและตอน) — ยังไม่ทำ: bulk episode tools (จัดลำดับ/ตั้งราคา-
// เผยแพร่-คำเรียกตอนหลายตอนพร้อมกัน), "เพิ่มอัตโนมัติ" (zip bulk upload), ภาพ manga (ฝั่ง writer
// เองก็ยังไม่มี UI ให้ใช้เลย), ลบผลงาน/ตั้งนิยายแนะนำ (ไม่ได้ขอ) — flag ไว้ให้ user ตัดสินใจว่าจะเอา
// เพิ่มไหมในรอบถัดไป

import { db } from '../../db'
import { createSystemWriterNotice, writeAuditLog } from './admin.service'
import { deleteFile, getKeyFromUrl } from '../../lib/r2'
import {
  getWorkForEdit, updateWork, uploadCover, deleteWork,
  getMyEpisodes, createEpisode, getEpisodeForEdit, updateEpisode, deleteEpisode,
  getWorkStats, getWorkViewsMonthly, getWorkViewsYearly, getWorkTopEpisodes,
  type UpdateWorkInput, type CreateEpisodeInput, type UpdateEpisodeInput,
} from '../writer/writer.service'

async function resolveWorkAuthorId(workUuid: string): Promise<bigint> {
  const row = await db
    .selectFrom('works')
    .select('author_id')
    .where('uuid', '=', workUuid)
    .where('status', '=', 'active')
    .executeTakeFirst()
  if (!row) throw new Error('WORK_NOT_FOUND')
  return row.author_id
}

// 2026-08-10 — เหมือน resolveWorkAuthorId ทุกอย่าง แต่ไม่กรอง status='active' ใช้เฉพาะจุดที่ต้องเข้าถึง
// งานที่ถูก soft-delete ไปแล้วได้ด้วย (ดูรายละเอียด/ลบถาวรต่อ) — ฟังก์ชัน mutation อื่นๆ ทั้งหมด
// (updateWorkAdmin, uploadCoverAdmin, episode CRUD ฯลฯ) ยังใช้ตัวกรอง active-only เดิมเหมือนเดิม
// ตั้งใจไม่ให้แก้ไข/อัปโหลดอะไรกับงานที่ถูกลบไปแล้วได้
async function resolveWorkAuthorIdAnyStatus(workUuid: string): Promise<bigint> {
  const row = await db
    .selectFrom('works')
    .select('author_id')
    .where('uuid', '=', workUuid)
    .executeTakeFirst()
  if (!row) throw new Error('WORK_NOT_FOUND')
  return row.author_id
}

async function resolveEpisodeAuthorId(epId: bigint): Promise<bigint> {
  const row = await db
    .selectFrom('work_ep as e')
    .innerJoin('works as w', 'w.p_id', 'e.p_id')
    .select('w.author_id')
    .where('e.ep_id', '=', epId)
    .where('e.status', '=', 'active')
    .executeTakeFirst()
  if (!row) throw new Error('EPISODE_NOT_FOUND')
  return row.author_id
}

// =============================================================
// Gallery — "ผลงาน" หน้าแรก (2026-08-04 user ขอ: การ์ด hover โชว์ชื่อเต็ม, เรียงตามแก้ไขล่าสุด,
// ค้นหาชื่อ, กรองนักเขียน, กรอง 18+)
//
// 2026-08-04 แก้: ตัวกรองนักเขียนเดิมเป็น dropdown เลือกจากรายชื่อ — user ขอเปลี่ยนเป็นพิมพ์ค้นหา
// username/display name แทน (ตรงกับ pattern ค้นหาชื่อเรื่องข้างๆ กันเลย) ตัดฟังก์ชัน
// listWorkAuthors() (เดิมใช้ป้อน dropdown) ทิ้งไปเพราะไม่มีที่ใช้แล้ว
// =============================================================

export async function listWorksGallery(params: {
  page:            number
  limit:           number
  search?:         string
  authorSearch?:   string
  ageRate?:        'all' | '18+'
  /** เฉพาะเรื่องที่เผยแพร่แล้ว (publish_status=1) — ใช้กับ picker "นิยายแนะนำ" เท่านั้น (2026-08-04
      เจอตอนทดสอบว่าดันเรื่อง draft เข้าคิวบูสต์ได้ แต่ไม่มีวันโผล่หน้าเว็บจริงเพราะ getWorks()
      กรอง publish_status=1 อยู่แล้วเสมอ — งงเปล่าประโยชน์ ป้องกันตั้งแต่ตัวเลือกเลยดีกว่า) */
  publishedOnly?:  boolean
  /** ตัวกรอง "สถานะ" ในหน้า gallery หลัก (2026-08-05) — 1=เผยแพร่แล้วเท่านั้น, 0=ยังไม่เผยแพร่
      เท่านั้น (ซ่อนอยู่), undefined=ทั้งหมด ต่างจาก publishedOnly ตรงที่เลือกได้ทั้ง 2 ทาง ไม่ได้
      บังคับกรองเอาแค่เผยแพร่แล้วเสมอ */
  publishStatus?:  0 | 1
  /** 2026-08-10 ใหม่ — เดิม gallery กรอง status='active' เสมอ (งานที่ถูก soft-delete ไปแล้วไม่โผล่
      เลย) ตอนนี้เลือกดูเฉพาะที่ถูกลบได้ผ่านตัวกรอง "สถานะ" เดียวกับ publishStatus ในหน้าเว็บ
      (undefined = default = active เท่านั้นเหมือนเดิม, 'deleted' = เฉพาะที่ถูก soft-delete) */
  status?: 'active' | 'deleted'
}) {
  const { page, limit, search, authorSearch, ageRate, publishedOnly, publishStatus, status } = params
  const offset = (page - 1) * limit
  const statusFilter = status ?? 'active'

  let query = db
    .selectFrom('works as w')
    .innerJoin('users as u', 'u.id', 'w.author_id')
    .select([
      'w.uuid', 'w.title', 'w.cover_image', 'w.type', 'w.age_rate',
      'w.publish_status', 'w.status', 'w.updated_at',
      'u.uuid as author_uuid', 'u.display_name as author_name', 'u.u_name as author_u_name',
    ])
    .where('w.status', '=', statusFilter)

  if (search) query = query.where('w.title', 'ilike', `%${search}%`)
  if (authorSearch) {
    query = query.where((eb) =>
      eb.or([
        eb('u.display_name', 'ilike', `%${authorSearch}%`),
        eb('u.u_name', 'ilike', `%${authorSearch}%`),
      ])
    )
  }
  if (ageRate) query = query.where('w.age_rate', '=', ageRate)
  if (publishedOnly) query = query.where('w.publish_status', '=', 1)
  if (publishStatus !== undefined) query = query.where('w.publish_status', '=', publishStatus)

  const rows = await query
    .orderBy('w.updated_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  let countQuery = db
    .selectFrom('works as w')
    .innerJoin('users as u', 'u.id', 'w.author_id')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('w.status', '=', statusFilter)

  if (search) countQuery = countQuery.where('w.title', 'ilike', `%${search}%`)
  if (authorSearch) {
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb('u.display_name', 'ilike', `%${authorSearch}%`),
        eb('u.u_name', 'ilike', `%${authorSearch}%`),
      ])
    )
  }
  if (ageRate) countQuery = countQuery.where('w.age_rate', '=', ageRate)
  if (publishedOnly) countQuery = countQuery.where('w.publish_status', '=', 1)
  if (publishStatus !== undefined) countQuery = countQuery.where('w.publish_status', '=', publishStatus)

  const countRow = await countQuery.executeTakeFirstOrThrow()
  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({
      uuid:           r.uuid,
      title:          r.title,
      cover_image:    r.cover_image,
      type:           r.type,
      age_rate:       r.age_rate ?? 'all',
      publish_status: r.publish_status,
      status:         r.status as 'active' | 'deleted',
      updated_at:     r.updated_at,
      author: { uuid: r.author_uuid, display_name: r.author_name, u_name: r.author_u_name },
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

// =============================================================
// Work detail/edit — delegate ไปที่ writer.service.ts โดยสวม author_id ของเจ้าของจริง
// =============================================================

export async function getWorkDetailAdmin(workUuid: string) {
  // ไม่ใช้ getWorkForEdit() ของ writer.service.ts ตรงๆ เพราะฟังก์ชันนั้นกรอง status='active' เสมอ
  // (ถูกต้องแล้วสำหรับนักเขียนเจ้าของเอง — ไม่ควรเห็นงานที่ตัวเองลบไปแล้ว) แต่แอดมินต้องเปิดดูงานที่ถูก
  // soft-delete ไปแล้วได้ด้วย (กดปุ่ม "ลบถาวร" ต่อจากที่นี่ได้) เลย query เองแยกต่างหาก คัด field
  // เท่าที่หน้า /works/[uuid] ใช้จริง + ใส่ status ไปด้วยให้ frontend รู้ว่างานนี้ถูกลบไปแล้วหรือยัง
  const authorId = await resolveWorkAuthorIdAnyStatus(workUuid)

  const [row, author] = await Promise.all([
    db
      .selectFrom('works as c')
      .leftJoin('categories as cm', 'cm.id', 'c.category_main')
      .leftJoin('categories as cs', 'cs.id', 'c.category_sub')
      .select([
        'c.uuid', 'c.title', 'c.original_title', 'c.description', 'c.synopsis', 'c.cover_image',
        'c.type', 'c.age_rate', 'c.is_translated', 'c.tags', 'c.is_one_shot', 'c.completion_status',
        'c.publish_status', 'c.status', 'c.created_at', 'c.updated_at',
        'cm.id as category_main_id', 'cm.name as category_main_name',
        'cs.id as category_sub_id', 'cs.name as category_sub_name',
      ])
      .where('c.uuid', '=', workUuid)
      .executeTakeFirstOrThrow(),
    db.selectFrom('users').select(['uuid', 'display_name', 'u_name']).where('id', '=', authorId).executeTakeFirstOrThrow(),
  ])

  const work = {
    uuid:              row.uuid,
    title:             row.title,
    original_title:    row.original_title,
    description:       row.description,
    synopsis:          row.synopsis,
    cover_image:       row.cover_image,
    type:              row.type,
    age_rate:          row.age_rate ?? 'all',
    is_translated:     row.is_translated,
    tags:              row.tags,
    is_one_shot:       row.is_one_shot,
    completion_status: row.completion_status,
    publish_status:    row.publish_status,
    status:            row.status as 'active' | 'deleted',
    category_main: row.category_main_id
      ? { id: String(row.category_main_id), name: row.category_main_name }
      : null,
    category_sub: row.category_sub_id
      ? { id: String(row.category_sub_id), name: row.category_sub_name }
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
  return { ...work, author }
}

// =============================================================
// ลบผลงาน (2026-08-10, ใหม่ — user ขอเพิ่มหลังคุยเรื่อง cleanup ข้อมูลทดสอบ)
// =============================================================

// ---- ลบแบบซ่อน (soft delete) — level >= 9 (ตามเกณฑ์เดิมของทั้งไฟล์) delegate ไปที่
// deleteWork() ของ writer.service.ts ตรงๆ เหมือน pattern อื่นในไฟล์นี้ ----
export async function deleteWorkAdmin(adminId: bigint, workUuid: string) {
  const authorId = await resolveWorkAuthorId(workUuid) // active-only — ลบซ้ำงานที่ลบไปแล้วไม่ได้ (ไม่มีประโยชน์)
  await deleteWork(authorId, workUuid)
  await writeAuditLog(adminId, 'ADMIN_SOFT_DELETE_WORK', 'work', workUuid)
}

// ---- ลบถาวร (2026-08-10, ใหม่) — level 10 เท่านั้น (เช็คซ้ำอีกชั้นที่ route level เพราะทั้งไฟล์นี้
// gate ไว้แค่ level >= 9) ใช้เมื่อผิดพลาดจริงๆ เท่านั้น ตามที่ user ย้ำหลายรอบ ("ไม่ควรเกิดขึ้น") —
// ลบไม่ผ่าน UI ปกติ (ไม่มีปุ่ม publish/unpublish ธรรมดาไปถึงจุดนี้ได้)
//
// ล้าง FK ที่เป็น NO ACTION ทุกตัวก่อน (เช็คจาก information_schema ของ DB จริงแล้ว — ดูรายละเอียดที่
// เช็คไว้ตอนออกแบบ ไม่ได้เดาจากไฟล์ migration เฉยๆ เพราะบาง migration อาจตกหล่นไม่ครบ) ที่เหลือ
// (ON DELETE CASCADE: work_ep, work_tags, tts_work_access, tts_work_character_labels,
// user_work_auto_read_preferences, tts_requests, work_ep_image, work_ep_bookmarks,
// novel_block_reports, tts_episode_edit_saves, tts_request_episodes) ปล่อยให้ DB จัดการเอง
// ตอน DELETE FROM works ตัวสุดท้าย — ทำทั้งหมดในทรานแซกชันเดียว กันข้อมูลค้างครึ่งๆ กลางๆ ถ้าพังกลางทาง
//
// บล็อกไว้ถ้ามีประวัติการซื้อจริง (ep_shop) แล้ว — ข้อมูลการเงิน/ประวัติซื้อไม่ควรลบถาวรได้ง่ายๆ แม้จะ
// เป็น level 10 ก็ตาม (กันกดผิดกับงานที่มีคนซื้อจริงไปแล้ว ต่างจากงานทดสอบที่ยังไม่เผยแพร่เลย)
export async function permaDeleteWorkAdmin(adminId: bigint, workUuid: string) {
  const work = await db
    .selectFrom('works')
    .select(['p_id', 'title', 'cover_image'])
    .where('uuid', '=', workUuid)
    .executeTakeFirst()
  if (!work) throw new Error('WORK_NOT_FOUND')

  const episodeRows = await db
    .selectFrom('work_ep')
    .select('ep_id')
    .where('p_id', '=', work.p_id)
    .execute()
  const epIdList = episodeRows.map((e) => e.ep_id)

  if (epIdList.length > 0) {
    const purchaseCount = await db
      .selectFrom('ep_shop')
      .select(({ fn }) => fn.countAll<string>().as('total'))
      .where('ep_id', 'in', epIdList)
      .executeTakeFirstOrThrow()
    if (Number(purchaseCount.total) > 0) throw new Error('WORK_HAS_PURCHASES')
  }

  // 2026-08-11 user ถาม — "ลบถาวร" เดิมลบแค่แถวใน DB ไฟล์จริงบน R2 (ปก, ภาพตอน manga, เสียง TTS)
  // ยังค้างอยู่เป็นขยะตลอดไป ขัดกับเจตนา "ลบถาวรจริง" — ต้องเก็บ URL/key พวกนี้ไว้ก่อนที่แถวจะถูกลบ
  // (ดึงจาก DB ไม่ได้แล้วหลัง transaction ผ่าน) แล้วค่อยลบออกจาก R2 จริงหลัง DB ลบสำเร็จ
  const [episodeImages, ttsAudio] = await Promise.all([
    epIdList.length > 0
      ? db.selectFrom('work_ep_image').select('image_path').where('ep_id', 'in', epIdList).execute()
      : Promise.resolve([]),
    epIdList.length > 0
      ? db.selectFrom('tts_jobs').select('audio_key').where('ep_id', 'in', epIdList).where('audio_key', 'is not', null).execute()
      : Promise.resolve([]),
  ])

  await db.transaction().execute(async (trx) => {
    if (epIdList.length > 0) {
      await trx.deleteFrom('ep_shop').where('ep_id', 'in', epIdList).execute()
      await trx.deleteFrom('tts_jobs').where('ep_id', 'in', epIdList).execute()
      await trx.deleteFrom('work_comments').where('episode_id', 'in', epIdList).execute()
    }
    await trx.deleteFrom('episode_upload_jobs').where('p_id', '=', work.p_id).execute()
    await trx.deleteFrom('featured_works').where('p_id', '=', work.p_id).execute()
    await trx.deleteFrom('work_bookmarks').where('p_id', '=', work.p_id).execute()
    await trx.deleteFrom('work_comments').where('work_id', '=', work.p_id).execute()
    await trx.deleteFrom('work_ep_views').where('p_id', '=', work.p_id).execute()
    await trx.deleteFrom('work_favorite').where('p_id', '=', work.p_id).execute()
    await trx.deleteFrom('writer_admin_notices').where('work_id', '=', work.p_id).execute()
    await trx.deleteFrom('works').where('p_id', '=', work.p_id).execute()
  })

  // ลบไฟล์จริงบน R2 หลัง DB ลบสำเร็จเท่านั้น (ถ้า DB transaction ล้มก่อน จะได้ไม่ลบไฟล์ทิ้งไปเฉยๆ
  // ทั้งที่แถวยังอยู่) แบบ best-effort — ไฟล์ไหนลบไม่สำเร็จ (network/permission) แค่ log ไว้ ไม่ throw
  // ต่อ เพราะข้อมูลใน DB ถูกลบไปแล้วจริง ย้อนกลับไม่ได้อยู่ดี ไม่มีประโยชน์จะ fail ทั้ง request
  const r2Keys = [
    ...(work.cover_image ? [getKeyFromUrl(work.cover_image)] : []),
    ...episodeImages.map((img) => getKeyFromUrl(img.image_path)),
    ...ttsAudio.map((job) => job.audio_key!),
  ]
  await Promise.all(
    r2Keys.map((key) =>
      deleteFile(key).catch((err) => {
        console.error(`[permaDeleteWorkAdmin] failed to delete R2 object "${key}" for work ${workUuid}:`, err)
      }),
    ),
  )

  await writeAuditLog(adminId, 'ADMIN_PERMA_DELETE_WORK', 'work', workUuid, work.title)
}

export async function updateWorkAdmin(adminId: bigint, workUuid: string, data: UpdateWorkInput) {
  const workBefore = await db
    .selectFrom('works')
    .select(['p_id', 'author_id', 'title', 'publish_status'])
    .where('uuid', '=', workUuid)
    .where('status', '=', 'active')
    .executeTakeFirst()
  if (!workBefore) throw new Error('WORK_NOT_FOUND')

  const authorId = workBefore.author_id
  const updated = await updateWork(authorId, workUuid, data)
  await writeAuditLog(adminId, 'ADMIN_UPDATE_WORK', 'work', workUuid, data.title ?? undefined)

  // การปิดเผยแพร่โดย Admin ต้องมีร่องรอยให้นักเขียนเห็น แต่ไม่เปิดเผยว่าใครสั่ง
  if (data.publish_status === 0 && workBefore.publish_status !== 0) {
    await createSystemWriterNotice({
      writerId: authorId,
      workId: workBefore.p_id,
      subject: 'ระบบเปลี่ยนสถานะผลงาน',
      message: `ผลงาน “${workBefore.title}” ถูกปิดการเผยแพร่แล้ว`,
      severity: 'risk',
      metadata: { action: 'work_unpublished', work_uuid: workUuid },
    })
  }

  return updated
}

export async function uploadCoverAdmin(
  adminId: bigint,
  workUuid: string,
  fileBuffer: Buffer,
  contentType: string,
  filename: string,
) {
  const authorId = await resolveWorkAuthorId(workUuid)
  const result = await uploadCover(authorId, workUuid, fileBuffer, contentType, filename)
  await writeAuditLog(adminId, 'ADMIN_UPDATE_WORK_COVER', 'work', workUuid)
  return result
}

// =============================================================
// Work Stats — delegate ไปที่ writer.service.ts เหมือนกัน (2026-08-05, ใหม่)
// user ขอให้แอดมินดูสถิติเจาะลึกของผลงานได้แบบเดียวกับที่นักเขียนเห็นเอง — read-only ล้วน
// เลยไม่ต้องเขียน audit log (ตาม pattern เดียวกับ getWorkDetailAdmin/getEpisodesAdmin ด้านบน
// ที่เป็น GET ล้วนก็ไม่มี audit log เหมือนกัน)
// =============================================================

export async function getWorkStatsAdmin(workUuid: string) {
  const authorId = await resolveWorkAuthorId(workUuid)
  return getWorkStats(authorId, workUuid)
}

export async function getWorkViewsMonthlyAdmin(workUuid: string, year: number, month: number) {
  const authorId = await resolveWorkAuthorId(workUuid)
  return getWorkViewsMonthly(authorId, workUuid, year, month)
}

export async function getWorkViewsYearlyAdmin(workUuid: string, year: number) {
  const authorId = await resolveWorkAuthorId(workUuid)
  return getWorkViewsYearly(authorId, workUuid, year)
}

export async function getWorkTopEpisodesAdmin(workUuid: string, limit: number) {
  const authorId = await resolveWorkAuthorId(workUuid)
  return getWorkTopEpisodes(authorId, workUuid, limit)
}

// =============================================================
// Episode list/CRUD — delegate เหมือนกัน
// =============================================================

export async function getEpisodesAdmin(workUuid: string) {
  const authorId = await resolveWorkAuthorId(workUuid)
  return getMyEpisodes(authorId, workUuid)
}

export async function createEpisodeAdmin(adminId: bigint, workUuid: string, data: CreateEpisodeInput) {
  const authorId = await resolveWorkAuthorId(workUuid)
  const episode = await createEpisode(authorId, workUuid, data)
  await writeAuditLog(adminId, 'ADMIN_CREATE_EPISODE', 'work_ep', episode.ep_id, data.ep_name)
  return episode
}

export async function getEpisodeDetailAdmin(epId: bigint) {
  const authorId = await resolveEpisodeAuthorId(epId)
  return getEpisodeForEdit(authorId, epId)
}

export async function updateEpisodeAdmin(adminId: bigint, epId: bigint, data: UpdateEpisodeInput) {
  const episodeBefore = await db
    .selectFrom('work_ep as e')
    .innerJoin('works as w', 'w.p_id', 'e.p_id')
    .select(['e.ep_id', 'e.p_id', 'e.ep_name', 'e.publish_status', 'w.author_id', 'w.uuid as work_uuid', 'w.title as work_title'])
    .where('e.ep_id', '=', epId)
    .where('e.status', '=', 'active')
    .executeTakeFirst()
  if (!episodeBefore) throw new Error('EPISODE_NOT_FOUND')

  const authorId = episodeBefore.author_id
  const updated = await updateEpisode(authorId, epId, data)
  const note = data.publish_status ? `publish_status → ${data.publish_status}${data.ep_name ? ` (${data.ep_name})` : ''}` : data.ep_name
  await writeAuditLog(adminId, 'ADMIN_UPDATE_EPISODE', 'work_ep', String(epId), note)

  if (data.publish_status === 'hide' && episodeBefore.publish_status !== 'hide') {
    await createSystemWriterNotice({
      writerId: authorId,
      workId: episodeBefore.p_id,
      subject: 'ระบบเปลี่ยนสถานะตอน',
      message: `ตอน “${episodeBefore.ep_name}” ของผลงาน “${episodeBefore.work_title}” ถูกปิดการเผยแพร่แล้ว`,
      severity: 'risk',
      metadata: {
        action: 'episode_unpublished',
        episode_id: String(epId),
        work_uuid: episodeBefore.work_uuid,
      },
    })
  }

  return updated
}

export async function deleteEpisodeAdmin(adminId: bigint, epId: bigint) {
  const episodeBefore = await db
    .selectFrom('work_ep as e')
    .innerJoin('works as w', 'w.p_id', 'e.p_id')
    .select(['e.ep_id', 'e.p_id', 'e.ep_name', 'w.author_id', 'w.uuid as work_uuid', 'w.title as work_title'])
    .where('e.ep_id', '=', epId)
    .where('e.status', '=', 'active')
    .executeTakeFirst()
  if (!episodeBefore) throw new Error('EPISODE_NOT_FOUND')

  const authorId = episodeBefore.author_id
  await deleteEpisode(authorId, epId)
  await writeAuditLog(adminId, 'ADMIN_DELETE_EPISODE', 'work_ep', String(epId))
  await createSystemWriterNotice({
    writerId: authorId,
    workId: episodeBefore.p_id,
    subject: 'ระบบดำเนินการกับตอน',
    message: `ตอน “${episodeBefore.ep_name}” ของผลงาน “${episodeBefore.work_title}” ถูกนำออกจากระบบแล้ว`,
    severity: 'critical',
    metadata: {
      action: 'episode_deleted',
      episode_id: String(epId),
      work_uuid: episodeBefore.work_uuid,
    },
  })
}
