import { db } from '../../db'
import { uploadFile, deleteFile, getPublicUrl, getKeyFromUrl, avatarKey, isAllowedImageType } from '../../lib/r2'
import { processImage } from '../../lib/image'

// ---- สถิติหน้าโปรไฟล์ (อ่านแล้ว/เก็บเข้าคลัง/หัวใจ/ความคิดเห็น) ----
// ใช้ร่วมกันทั้ง "โปรไฟล์ตัวเอง" (GET /users/me) และ "โปรไฟล์คนอื่น" (GET /users/:uuid public)
// เทียบ terminology กับ Tofu Novel ที่ user เอามาอ้างอิง: "ชั้นหนังสือ"→"เก็บเข้าคลัง" (ตรงกับ
// work_bookmarks ที่ตั้งชื่อไว้แล้วในระบบนี้), "รีวิว"→ตัดออก (ระบบนี้ไม่มี concept รีวิวแยกจาก
// หัวใจ/คอมเม้นเลย ไม่สร้างของปลอมมาแทน ใช้ "หัวใจ" ที่มีจริงแทน)
//
// 2026-07-29 มติแก้: ตัวเลข 4 อันนี้มีความหมายต่างกันตาม role — นักอ่านทั่วไปเป็น "ค่าของตัวเอง"
// (อ่าน/เก็บ/กดใจ/คอมเม้นไปกี่ครั้ง) แต่นักเขียนเป็น "ค่ารวมจากผลงานตัวเอง" (คนอื่นอ่าน/เก็บ/กดใจ/
// คอมเม้นผลงานเรารวมกี่ครั้ง) เหมือนสถิติช่องบน YouTube ไม่ใช่ประวัติการดูของเจ้าของช่องเอง
export async function getProfileStats(userId: bigint, isWriter: boolean) {
  const [reads, bookmarks, favorites, comments, followers, following] = await Promise.all([
    isWriter
      ? db.selectFrom('works')
          .select(({ fn }) => fn.sum<string | null>('view_count').as('count'))
          .where('author_id', '=', userId)
          .where('status', '=', 'active')
          .executeTakeFirstOrThrow()
      : db.selectFrom('work_ep_views')
          .select(({ fn }) => fn.count<string>('p_id').distinct().as('count'))
          .where('user_id', '=', userId)
          .executeTakeFirstOrThrow(),
    isWriter
      ? db.selectFrom('work_bookmarks as b')
          .innerJoin('works as w', 'w.p_id', 'b.p_id')
          .select(({ fn }) => fn.countAll<string>().as('count'))
          .where('w.author_id', '=', userId)
          .where('w.status', '=', 'active')
          .executeTakeFirstOrThrow()
      : db.selectFrom('work_bookmarks')
          .select(({ fn }) => fn.countAll<string>().as('count'))
          .where('user_id', '=', userId)
          .executeTakeFirstOrThrow(),
    isWriter
      ? db.selectFrom('work_favorite as f')
          .innerJoin('works as w', 'w.p_id', 'f.p_id')
          .select(({ fn }) => fn.countAll<string>().as('count'))
          .where('w.author_id', '=', userId)
          .where('w.status', '=', 'active')
          .executeTakeFirstOrThrow()
      : db.selectFrom('work_favorite')
          .select(({ fn }) => fn.countAll<string>().as('count'))
          .where('user_id', '=', userId)
          .executeTakeFirstOrThrow(),
    isWriter
      ? db.selectFrom('work_comments as c')
          .innerJoin('works as w', 'w.p_id', 'c.work_id')
          .select(({ fn }) => fn.countAll<string>().as('count'))
          .where('w.author_id', '=', userId)
          .where('w.status', '=', 'active')
          .where('c.status', '=', 'active')
          .where('c.parent_id', 'is', null) // นับเฉพาะคอมเม้นระดับบนสุด ตรงกับ getWorkCounts() (works.service.ts)
          .executeTakeFirstOrThrow()
      : db.selectFrom('work_comments')
          .select(({ fn }) => fn.countAll<string>().as('count'))
          .where('user_id', '=', userId)
          .where('status', '=', 'active')
          .executeTakeFirstOrThrow(),
    // "ผู้ติดตาม" — คนอื่นที่ follow เรา (2026-07-28 user ขอเพิ่มกล่องนี้ในหน้าโปรไฟล์)
    db.selectFrom('user_followers')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('following_id', '=', userId)
      .executeTakeFirstOrThrow(),
    // "กำลังติดตาม" — เราไป follow คนอื่นไว้กี่คน
    db.selectFrom('user_followers')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('follower_id', '=', userId)
      .executeTakeFirstOrThrow(),
  ])

  return {
    read_count:      Number(reads.count ?? 0), // SUM ของ 0 แถว (นักเขียนที่ยังไม่มีผลงาน) คืน null
    bookmark_count:  Number(bookmarks.count),
    favorite_count:  Number(favorites.count),
    comment_count:   Number(comments.count),
    follower_count:  Number(followers.count),
    following_count: Number(following.count),
  }
}

// ---- ช่องทางโซเชียล/เว็บไซต์ (user_social_links, migration 019) ----
// สูงสุด 4 อันต่อ user (เหมือน YouTube Studio ที่เพิ่ม "ลิงก์ช่อง" ได้หลายอัน) — บังคับที่นี่
// ระดับ service ไม่ใช่ DB constraint (เหมือน pattern โควต้า tag ที่ทำไปก่อนหน้านี้)
const MAX_SOCIAL_LINKS = 4

export async function getSocialLinks(userId: bigint) {
  return db
    .selectFrom('user_social_links')
    .select(['id', 'url', 'label'])
    .where('user_id', '=', userId)
    .orderBy('sort_order', 'asc')
    .execute()
}

// แทนที่ลิงก์ทั้งหมดของ user นี้ทีเดียว (ง่ายกว่า diff add/remove ทีละอัน — pattern เดียวกับ
// syncWorkTags()) ลำดับที่ส่งมาคือลำดับที่จะแสดงผล (sort_order = index ในลิสต์)
export async function setSocialLinks(userId: bigint, links: { url: string; label?: string | null }[]) {
  if (links.length > MAX_SOCIAL_LINKS) throw new Error('TOO_MANY_SOCIAL_LINKS')

  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom('user_social_links').where('user_id', '=', userId).execute()

    if (links.length > 0) {
      await trx
        .insertInto('user_social_links')
        .values(links.map((l, i) => ({ user_id: userId, url: l.url, label: l.label ?? null, sort_order: i })))
        .execute()
    }
  })

  return getSocialLinks(userId)
}

// ---- GET /users/:uuid (public) ----
// โปรไฟล์สาธารณะของ user คนไหนก็ได้ — ไม่ส่ง email/level ตรงๆ ออกไป (ส่งแค่ is_writer
// เป็น boolean พอ กันเปิดเผยว่าใครเป็น admin/level เท่าไหร่ตรงๆ ต่อสาธารณะ)
// viewerId = user ที่ล็อกอินอยู่ตอนนี้ (ถ้ามี) ใช้เช็คว่า viewer กำลัง follow เจ้าของโปรไฟล์
// นี้อยู่ไหม (is_following) — ไม่ล็อกอินก็ดูโปรไฟล์ได้ปกติ แค่ is_following เป็น false เสมอ
export async function getPublicProfile(uuid: string, viewerId: bigint | null = null) {
  const user = await db
    .selectFrom('users')
    .select(['id', 'uuid', 'display_name', 'user_img', 'level', 'bio', 'bookmarks_public', 'created_at'])
    .where('uuid', '=', uuid)
    // level > 7 = ทีมงาน/แอดมิน — ไม่ให้โผล่เป็นโปรไฟล์สาธารณะ (มติ 2026-08-05) ไม่กระทบการดู
    // โปรไฟล์ตัวเองของแอดมิน เพราะหน้านั้นใช้ /me คนละ endpoint กับตัวนี้
    .where('level', '<=', 7)
    .executeTakeFirst()

  if (!user) throw new Error('USER_NOT_FOUND')

  const [stats, social_links, followingRow] = await Promise.all([
    getProfileStats(user.id, user.level >= 6),
    getSocialLinks(user.id),
    viewerId
      ? db.selectFrom('user_followers')
          .select('follower_id')
          .where('follower_id', '=', viewerId)
          .where('following_id', '=', user.id)
          .executeTakeFirst()
      : Promise.resolve(null),
  ])

  return {
    uuid: user.uuid,
    display_name: user.display_name,
    user_img: user.user_img,
    bio: user.bio,
    social_links: social_links.map((l) => ({ url: l.url, label: l.label })),
    is_writer: user.level >= 6,
    bookmarks_public: user.bookmarks_public,
    is_following: Boolean(followingRow),
    created_at: user.created_at,
    stats,
  }
}

// ---- ค้นหานักเขียน (หน้า /search โหมด "นักเขียน") ----
// 2026-07-30: user ชี้ว่าโหมด "นักเขียน" เดิมยังคืนเป็นการ์ดนิยาย (แค่กรองด้วยชื่อผู้แต่ง)
// ทั้งที่ควรเป็นการค้นหา "คนเขียน" จริงๆ — ค้นเฉพาะ user ที่เป็นนักเขียน (level >= 6)
// ด้วยชื่อที่แสดง คืนข้อมูลเบื้องต้นพอสำหรับการ์ดแนวนอน (avatar/ชื่อ/ยอดติดตาม/ผลงาน/bio)
export async function searchWriters(search: string | undefined, page: number, limit: number) {
  const offset = (page - 1) * limit

  // level >= 6 = นักเขียน, level <= 7 กันไม่ให้แอดมิน (level 8+) หลุดมาโผล่ในผลค้นหา (มติ 2026-08-05)
  let dataQuery = db
    .selectFrom('users')
    .select(['id', 'uuid', 'display_name', 'user_img', 'bio'])
    .where('level', '>=', 6)
    .where('level', '<=', 7)

  let countQuery = db
    .selectFrom('users')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('level', '>=', 6)
    .where('level', '<=', 7)

  if (search) {
    const term = `%${search}%`
    dataQuery = dataQuery.where('display_name', 'ilike', term)
    countQuery = countQuery.where('display_name', 'ilike', term)
  }

  const rows = await dataQuery.orderBy('display_name', 'asc').limit(limit).offset(offset).execute()
  const countRow = await countQuery.executeTakeFirstOrThrow()
  const total = Number(countRow.total)

  const userIds = rows.map((r) => r.id)
  const followerCounts: Record<string, number> = {}
  const workCounts: Record<string, number> = {}

  if (userIds.length > 0) {
    const [followers, works] = await Promise.all([
      db.selectFrom('user_followers')
        .select(['following_id', ({ fn }) => fn.countAll<string>().as('count')])
        .where('following_id', 'in', userIds)
        .groupBy('following_id')
        .execute(),
      db.selectFrom('works')
        .select(['author_id', ({ fn }) => fn.countAll<string>().as('count')])
        .where('author_id', 'in', userIds)
        .where('publish_status', '=', 1)
        .where('status', '=', 'active')
        .groupBy('author_id')
        .execute(),
    ])
    for (const f of followers) followerCounts[String(f.following_id)] = Number(f.count)
    for (const w of works) workCounts[String(w.author_id)] = Number(w.count)
  }

  return {
    data: rows.map((r) => ({
      uuid: r.uuid,
      display_name: r.display_name,
      user_img: r.user_img,
      bio: r.bio,
      follower_count: followerCounts[String(r.id)] ?? 0,
      work_count: workCounts[String(r.id)] ?? 0,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

export async function updateProfile(
  uuid: string,
  input: {
    display_name?:     string
    u_name?:           string
    bio?:              string | null
    social_media?:     { facebook?: string; twitter?: string; instagram?: string }
    auto_ep_purchase?: boolean
    load_all_images?:  boolean
    bookmarks_public?: boolean
  }
) {
  // ถ้าจะเปลี่ยน u_name ต้องเช็คก่อนว่าซ้ำกับคนอื่นไหม
  if (input.u_name) {
    const existing = await db
      .selectFrom('users')
      .select('u_name')
      .where('u_name', '=', input.u_name)
      .where('uuid', '!=', uuid)   // ไม่นับตัวเอง
      .executeTakeFirst()

    if (existing) throw new Error('USERNAME_TAKEN')
  }

  // สร้าง object เฉพาะ field ที่ส่งมาจริงๆ
  // ถ้าไม่ส่งมา ไม่ต้อง update — ไม่งั้นค่าเดิมจะถูก overwrite ด้วย undefined
  const updateData: Record<string, unknown> = {}
  if (input.display_name     !== undefined) updateData.display_name     = input.display_name
  if (input.u_name           !== undefined) updateData.u_name           = input.u_name
  if (input.bio              !== undefined) updateData.bio              = input.bio
  if (input.auto_ep_purchase !== undefined) updateData.auto_ep_purchase = input.auto_ep_purchase
  if (input.load_all_images  !== undefined) updateData.load_all_images  = input.load_all_images
  if (input.bookmarks_public !== undefined) updateData.bookmarks_public = input.bookmarks_public

  // social_media ต้อง merge กับของเดิม ไม่ใช่ overwrite ทั้งก้อน (เผื่อมี facebook/twitter/
  // instagram ตั้งไว้จากช่องทางอื่นในอนาคต)
  if (input.social_media !== undefined) {
    const current = await db.selectFrom('users').select('social_media').where('uuid', '=', uuid).executeTakeFirst()
    updateData.social_media = { ...(current?.social_media ?? {}), ...input.social_media }
  }

  updateData.updated_at = new Date()

  const updated = await db
    .updateTable('users')
    .set(updateData)
    .where('uuid', '=', uuid)
    .returning(['uuid', 'u_name', 'display_name', 'email', 'level', 'user_img', 'bio', 'social_media', 'auto_ep_purchase', 'load_all_images', 'bookmarks_public'])
    .executeTakeFirstOrThrow()

  return updated
}

// ---- POST /users/me/avatar ----
// อัปโหลดรูปโปรไฟล์ — key มี timestamp ต่อท้ายเสมอ (ไม่ใช่ key คงที่แบบเดิม) กัน browser/R2 CDN
// cache รูปเก่าค้าง (URL เดิมทุกครั้งที่อัปโหลด ทำให้เบราว์เซอร์คิดว่าเป็นรูปเดียวกัน ไม่โหลดใหม่
// แม้เนื้อไฟล์จะเปลี่ยนไปแล้วจริงบน R2 — user เจอจริงว่าอัปโหลดสำเร็จแต่รูปไม่เปลี่ยน) — ต้องลบ
// รูปเก่าเองหลังอัปโหลดใหม่สำเร็จ เพราะ key ไม่คงที่แล้วจะไม่ทับของเดิมให้อัตโนมัติเหมือนก่อน
export async function uploadAvatar(uuid: string, fileBuffer: Buffer, contentType: string) {
  if (!isAllowedImageType(contentType)) throw new Error('INVALID_FILE_TYPE')

  const existing = await db.selectFrom('users').select('user_img').where('uuid', '=', uuid).executeTakeFirst()

  const processed = await processImage(fileBuffer, 'profile')
  const key = avatarKey(uuid, processed.ext, Date.now())
  await uploadFile(key, processed.buffer, processed.contentType)
  const publicUrl = getPublicUrl(key)

  await db
    .updateTable('users')
    .set({ user_img: publicUrl, updated_at: new Date() })
    .where('uuid', '=', uuid)
    .execute()

  // ลบรูปเก่าทิ้งหลังอัปโหลดใหม่สำเร็จแล้วเท่านั้น (ไม่ critical ถ้าลบไม่สำเร็จ ไม่ throw ทับ
  // response ที่สำเร็จแล้วจริง — กัน orphan สะสมใน R2 เฉยๆ ไม่ใช่ correctness ของ feature หลัก)
  if (existing?.user_img) {
    await deleteFile(getKeyFromUrl(existing.user_img)).catch(() => {})
  }

  return { user_img: publicUrl }
}

// ---- DELETE /users/me/avatar ----
export async function deleteAvatar(uuid: string) {
  // key มี timestamp ต่อท้ายแล้ว (ไม่คงที่แบบเดิม) ต้อง derive จาก URL ที่เก็บไว้จริงแทน
  const user = await db.selectFrom('users').select('user_img').where('uuid', '=', uuid).executeTakeFirstOrThrow()
  if (user.user_img) {
    await deleteFile(getKeyFromUrl(user.user_img))
  }

  await db
    .updateTable('users')
    .set({ user_img: null, updated_at: new Date() })
    .where('uuid', '=', uuid)
    .execute()
}

// =============================================================
// Writer Application (user_detail) — 2026-07-30
// ต่อฟอร์ม /writer/info (apps/web) เข้า backend จริง แทนที่ writer-application.store.ts
// เดิมที่ mock ล้วนๆ (เก็บแค่ localStorage) — status/data ตอนนี้อ่าน/เขียนจริงที่นี่
// =============================================================

export interface WriterApplicationInput {
  user_prefix: string
  first_name: string
  last_name: string
  national_id?: string
  id_address?: string
  id_province?: string
  id_district?: string
  id_subdistrict?: string
  id_postal_code?: string
  current_address?: string
  current_province?: string
  current_district?: string
  current_subdistrict?: string
  current_postal_code?: string
  user_phone: string
  bank_name: string
  bank_branch?: string
  bank_number?: string
}

// userLevel มาจาก JWT payload ตรงๆ (ดู user.routes.ts) — level>=6 หมายถึงอนุมัติเป็นนักเขียนแล้ว
// จริง เลยตัดสินได้ว่าการ submit ครั้งนี้คือ "แก้ไขข้อมูล" (application_type='edit') ไม่ใช่ "สมัครใหม่"
// (2026-08-18) — ต่างจาก new_writer ตรงที่: (1) ไม่บล็อกตอน latest.status==='approve' เพราะนั่นคือ
// สถานะปกติของนักเขียนที่จะมาแก้ไขข้อมูลของตัวเอง (2) approveWriterApplication() จะไม่เลื่อน level
// ซ้ำ (ดู comment ที่นั่น) — ทั้งสอง type ยังคงบล็อกซ้อนกันไม่ได้ (latest.status==='pending' เสมอ)
export async function submitWriterApplication(userId: bigint, userLevel: number, input: WriterApplicationInput) {
  const isExistingWriter = userLevel >= 6
  const applicationType: 'new_writer' | 'edit' = isExistingWriter ? 'edit' : 'new_writer'

  const latest = await db
    .selectFrom('user_detail')
    .select(['id', 'status'])
    .where('user_id', '=', userId)
    .orderBy('created_at', 'desc')
    .executeTakeFirst()

  if (latest?.status === 'pending') throw new Error('APPLICATION_ALREADY_PENDING')
  if (!isExistingWriter && latest?.status === 'approve') throw new Error('ALREADY_WRITER')

  const row = await db
    .insertInto('user_detail')
    .values({ user_id: userId, ...input, status: 'pending', application_type: applicationType })
    .returning(['id'])
    .executeTakeFirstOrThrow()

  return { id: String(row.id) }
}

/** ดึงคำขอล่าสุดของตัวเอง (ไม่ว่าสถานะไหน) — null ถ้ายังไม่เคยส่งเลย */
export async function getMyWriterApplication(userId: bigint) {
  const row = await db
    .selectFrom('user_detail')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('created_at', 'desc')
    .executeTakeFirst()

  if (!row) return null

  return {
    id: String(row.id),
    user_prefix: row.user_prefix,
    first_name: row.first_name,
    last_name: row.last_name,
    national_id: row.national_id,
    id_address: row.id_address,
    id_province: row.id_province,
    id_district: row.id_district,
    id_subdistrict: row.id_subdistrict,
    id_postal_code: row.id_postal_code,
    current_address: row.current_address,
    current_province: row.current_province,
    current_district: row.current_district,
    current_subdistrict: row.current_subdistrict,
    current_postal_code: row.current_postal_code,
    user_phone: row.user_phone,
    bank_name: row.bank_name,
    bank_branch: row.bank_branch,
    bank_number: row.bank_number,
    status: row.status,
    application_type: row.application_type,
    reject_reason: row.reject_reason,
    created_at: row.created_at,
  }
}

// ---- ประวัติการล็อกอินของตัวเอง (หน้าตั้งค่า, 2026-08-18) ----
// เหมือน getUserLoginRecords ใน admin.service.ts (admin ดูของ user คนอื่นผ่าน :uuid) แค่ scope
// ด้วย userId จาก JWT (user.id) ของตัวเองแทน — ไม่ต้องเช็คว่า user มีอยู่จริงเพราะมาจาก token ที่ authMiddleware ตรวจแล้ว
export async function getMyLoginHistory(userId: bigint, page: number, limit: number) {
  const offset = (page - 1) * limit

  const rows = await db
    .selectFrom('login_history')
    .select(['id', 'success', 'ip_address', 'user_agent', 'created_at'])
    .where('user_id', '=', userId)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  const countRow = await db
    .selectFrom('login_history')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow()
  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({
      id: String(r.id),
      success: r.success,
      ip_address: r.ip_address,
      user_agent: r.user_agent,
      created_at: r.created_at,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}