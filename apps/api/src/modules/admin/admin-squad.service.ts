// =============================================================
// Novel Platform — Admin Squad Service (2026-08-12, ใหม่)
// วางไว้ที่: apps/api/src/modules/admin/admin-squad.service.ts
// =============================================================
//
// "หน่วยรบ" — level 9 สร้างบัญชีแอดมิน level 8 ได้ (จำกัดโควตา/เดือน, level 10 ตั้งโควตาให้ได้),
// level 10 สร้าง level 9 ได้ไม่จำกัด ทั้งคู่ระงับ/ลบบัญชีที่ตัวเอง moderate ได้ (delegate ไปที่
// suspendActivity/liftActivitySuspension/permaDeleteUser ของ admin.service.ts ตรงๆ — ฟังก์ชันพวกนี้
// เช็ค assertCanModerate ให้ครบอยู่แล้ว ไม่ต้องเขียนซ้ำ)
//
// ⚠️ รหัสผ่าน — ห้ามเก็บแบบถอดกลับมาดูได้เด็ดขาด (เก็บ argon2 hash ทางเดียวเหมือนบัญชีทั่วไปทุก
// ประการ) โชว์ plaintext ให้เห็น "ครั้งเดียว" ตอน API คืนค่าจากการสร้าง/รีเซ็ตรหัสผ่านเท่านั้น — ปิด
// หน้าต่างแล้วหาไม่เจออีกเลย ต้องรีเซ็ตใหม่ถ้าทำหาย (มติ 2026-08-12 หลัง flag ปัญหาความปลอดภัยให้ user
// เห็นว่าที่ขอมาแต่แรก "กดลูกตาดูรหัสผ่านจริงได้" ทำไม่ได้จริงถ้าจะเก็บรหัสผ่านให้ปลอดภัย)

import { randomBytes, randomInt } from 'node:crypto'
import { hash } from '@node-rs/argon2'
import { uuidv7 } from 'uuidv7'
import { db } from '../../db'
import { writeAuditLog, assertCanModerate } from './admin.service'
import { hasPermission } from './admin-permissions.service'

// ต้องตรงกับ ARGON2_OPTIONS ใน auth.service.ts เป๊ะ (ค่าความแข็งแกร่ง hash เดียวกันทั้งระบบ)
const ARGON2_OPTIONS = { memoryCost: 65536, timeCost: 3, parallelism: 4 }

const DEFAULT_MONTHLY_QUOTA = 3
// level 8-10 = บัญชีแอดมินจริง (โชว์ในลิสต์เสมอไม่ว่าใครสร้าง) — level 1/7 = บัญชี "ผี" ที่สร้างผ่าน
// หน่วยรบไว้เผื่อไปตั้งเป็นนักเขียนของเว็บ (level 7) ทีหลัง (มติ 2026-08-12) โชว์ในลิสต์นี้ด้วยเฉพาะ
// ที่สร้างผ่านระบบนี้จริงๆ (created_by_admin_id ไม่ null) ไม่ดึง user ทั่วไปที่สมัครเองมาปน
const SQUAD_ADMIN_LEVELS = [8, 9, 10] as const
const SQUAD_MANAGED_LEVELS = [1, 7, 8, 9, 10] as const

function randomAlphaNumeric(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length }, () => chars[randomInt(chars.length)]).join('')
}

// สุ่ม username/อีเมล/รหัสผ่านเสมอ ไม่ให้พิมพ์เองเลยสักช่อง (ตั้งใจให้ไม่มีข้อมูลที่สืบไปหาตัวจริงได้ปน
// อยู่ในบัญชี) — display_name สุ่มให้เป็นค่าเริ่มต้น แต่รับ override เป็นชื่อที่ตั้งเองได้ (2026-08-12
// user ขอ "ทุกอันควรตั้งค่าชื่อได้") บัญชีระดับแอดมิน (8/9) ขึ้นต้นด้วย "แอดมิน" เสมอเวลาไม่ได้ตั้งชื่อเอง
// ส่วนบัญชี level 1 (เตรียมไปตั้งนักเขียนของเว็บทีหลัง) ไม่ใส่คำนำหน้าอะไร เพราะต้องดูเป็นบัญชีทั่วไป
// อีเมลใช้โดเมนสำรอง .local เหมือน pattern เดิมของ permaDeleteUser (deleted@deleted.local)
function generateSquadCredentials(targetLevel: 1 | 8 | 9, customDisplayName?: string) {
  const suffix = randomAlphaNumeric(10)
  const namePrefix = targetLevel === 1 ? '' : 'แอดมิน '
  return {
    u_name: `sq_${suffix}`,
    display_name: customDisplayName?.trim() || `${namePrefix}${suffix}`,
    email: `sq-${suffix}@squad.local`,
    password: randomBytes(12).toString('base64url'), // ~16 ตัวอักษร เดารหัสยากพอสำหรับบัญชีแอดมิน
  }
}

function startOfThisMonth(): Date {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

// ---- สร้างบัญชี — level 9/10 สร้าง level 1 ได้ไม่จำกัด (เตรียมไปตั้งนักเขียนของเว็บทีหลัง), level 9
// สร้าง level 8 ได้ (จำกัดโควตา/เดือน), level 10 สร้างได้ทั้ง level 1/8/9 ไม่จำกัดทั้งหมด ----
export async function createSquadAccount(
  creatorId: bigint,
  creatorLevel: number,
  targetLevel: 1 | 8 | 9,
  customDisplayName?: string,
) {
  const createActionKey = targetLevel === 1 ? 'squad.create_level1' : targetLevel === 8 ? 'squad.create_level8' : 'squad.create_level9'
  if (!(await hasPermission(creatorLevel, createActionKey))) throw new Error('SQUAD_INVALID_TARGET_LEVEL')

  // โควตารายเดือน — เฉพาะตอนสร้าง level 8 โดยไม่ใช่ level 10 เท่านั้นที่มีโควตา — level 10 สร้าง
  // ระดับไหนก็ไม่จำกัดเสมอ (ตามที่ user ระบุ "ฝั่ง lvl 10 จะเป็นการไม่จำกัด") level 1 ไม่มีโควตาเลยไม่ว่า
  // ใครสร้าง — เช็ค < 10 แทน === 9 เพราะ level 8 อาจได้รับสิทธิ์ squad.create_level8 จากหน้าตั้งค่าด้วย
  if (targetLevel === 8 && creatorLevel < 10) {
    const creator = await db
      .selectFrom('users')
      .select('squad_monthly_quota')
      .where('id', '=', creatorId)
      .executeTakeFirstOrThrow()
    const quota = creator.squad_monthly_quota ?? DEFAULT_MONTHLY_QUOTA
    const usedRow = await db
      .selectFrom('users')
      .select(({ fn }) => fn.countAll<string>().as('total'))
      .where('created_by_admin_id', '=', creatorId)
      .where('level', '=', 8)
      .where('created_at', '>=', startOfThisMonth())
      .executeTakeFirstOrThrow()
    if (Number(usedRow.total) >= quota) throw new Error('SQUAD_QUOTA_EXCEEDED')
  }

  const creds = generateSquadCredentials(targetLevel, customDisplayName)
  const password_hash = await hash(creds.password, ARGON2_OPTIONS)

  const created = await db
    .insertInto('users')
    .values({
      uuid: uuidv7(),
      u_name: creds.u_name,
      display_name: creds.display_name,
      email: creds.email,
      password_hash,
      level: targetLevel,
      created_by_admin_id: creatorId,
    })
    .returning(['id', 'uuid', 'u_name', 'display_name', 'level', 'created_at'])
    .executeTakeFirstOrThrow()

  await writeAuditLog(creatorId, 'CREATE_SQUAD_ACCOUNT', 'user', String(created.id), `สร้างบัญชี level ${targetLevel}: ${creds.u_name}`)

  return {
    uuid: created.uuid,
    u_name: created.u_name,
    display_name: created.display_name,
    level: created.level,
    created_at: created.created_at,
    password: creds.password, // โชว์ครั้งเดียวตรงนี้เท่านั้น — ไม่ถูกเก็บที่ไหนอีกหลังจากนี้
  }
}

// ---- รีเซ็ตรหัสผ่าน (ทำหายแล้วต้องออกชุดใหม่ — รหัสเดิมกู้คืนไม่ได้เพราะเก็บแค่ hash) ----
export async function resetSquadPassword(adminId: bigint, adminLevel: number, userUuid: string) {
  const user = await db.selectFrom('users').select(['id', 'level']).where('uuid', '=', userUuid).executeTakeFirst()
  if (!user) throw new Error('USER_NOT_FOUND')
  if (!(SQUAD_MANAGED_LEVELS as readonly number[]).includes(user.level)) throw new Error('SQUAD_NOT_A_SQUAD_ACCOUNT')
  assertCanModerate(adminLevel, user.level)

  const password = randomBytes(12).toString('base64url')
  const password_hash = await hash(password, ARGON2_OPTIONS)
  await db.updateTable('users').set({ password_hash, updated_at: new Date() }).where('id', '=', user.id).execute()
  await writeAuditLog(adminId, 'RESET_SQUAD_PASSWORD', 'user', String(user.id))
  return { password }
}

// ---- ตั้งโควตารายเดือนของ admin level 9 คนหนึ่ง (level 10 เท่านั้น — เช็คซ้ำที่ route อีกชั้น) ----
export async function updateSquadQuota(adminLevel: number, targetUuid: string, quota: number) {
  if (!(await hasPermission(adminLevel, 'squad.quota.set'))) throw new Error('SQUAD_QUOTA_LEVEL10_ONLY')
  const user = await db.selectFrom('users').select(['id', 'level']).where('uuid', '=', targetUuid).executeTakeFirst()
  if (!user) throw new Error('USER_NOT_FOUND')
  if (user.level !== 9) throw new Error('SQUAD_QUOTA_ONLY_FOR_LEVEL9')
  await db.updateTable('users').set({ squad_monthly_quota: quota, updated_at: new Date() }).where('id', '=', user.id).execute()
}

// ---- ลิสต์บัญชีที่เกี่ยวกับหน่วยรบ — บัญชีแอดมิน (level 8-10) ทุกบัญชีไม่ว่าใครสร้าง + บัญชี
// level 1/7 เฉพาะที่สร้างผ่านระบบนี้จริงๆ (created_by_admin_id ไม่ null — กัน user ทั่วไปที่สมัคร
// เองมาปนในลิสต์นี้) ----
export async function listSquadAdmins(viewerId: bigint, params: { onlyMine?: boolean; page: number; limit: number }) {
  const { onlyMine, page, limit } = params
  const offset = (page - 1) * limit

  const scopeFilter = (eb: any) =>
    eb.or([
      eb('u.level', 'in', SQUAD_ADMIN_LEVELS),
      eb.and([eb('u.level', 'in', [1, 7]), eb('u.created_by_admin_id', 'is not', null)]),
    ])

  let query = db
    .selectFrom('users as u')
    .leftJoin('users as creator', 'creator.id', 'u.created_by_admin_id')
    .leftJoin('user_activity_suspensions as s', (join) =>
      join.onRef('s.user_id', '=', 'u.id').on('s.lifted_at', 'is', null),
    )
    .select([
      'u.uuid', 'u.u_name', 'u.display_name', 'u.level', 'u.created_at', 'u.squad_monthly_quota',
      'creator.uuid as creator_uuid', 'creator.display_name as creator_display_name',
      's.id as suspension_id', 's.reason as suspension_reason',
    ])
    .where(scopeFilter)
    .where('u.deleted_at', 'is', null)

  if (onlyMine) query = query.where('u.created_by_admin_id', '=', viewerId)

  const rows = await query.orderBy('u.created_at', 'desc').limit(limit).offset(offset).execute()

  let countQuery = db
    .selectFrom('users as u')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where(scopeFilter)
    .where('u.deleted_at', 'is', null)
  if (onlyMine) countQuery = countQuery.where('u.created_by_admin_id', '=', viewerId)
  const countRow = await countQuery.executeTakeFirstOrThrow()
  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({
      uuid: r.uuid,
      u_name: r.u_name,
      display_name: r.display_name,
      level: r.level,
      created_at: r.created_at,
      quota: r.level === 9 ? (r.squad_monthly_quota ?? DEFAULT_MONTHLY_QUOTA) : null,
      creator: r.creator_uuid ? { uuid: r.creator_uuid, display_name: r.creator_display_name } : null,
      is_suspended: r.suspension_id !== null,
      suspension_reason: r.suspension_reason,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

// ---- ประวัติ — audit log เฉพาะ action ที่เกี่ยวกับบัญชีแอดมิน level 8-10 เท่านั้น (กรอง
// SUSPEND_ACTIVITY/LIFT_ACTIVITY_SUSPENSION/PERMA_DELETE_USER ทั่วไปที่ใช้กับ user ธรรมดาออกไป) ----
export async function getSquadHistory(page: number, limit: number) {
  const SQUAD_EVENT_TYPES = [
    'CREATE_SQUAD_ACCOUNT', 'RESET_SQUAD_PASSWORD',
    'SUSPEND_ACTIVITY', 'LIFT_ACTIVITY_SUSPENSION', 'PERMA_DELETE_USER',
  ]

  // ดึงมาเกินพอสมควรแล้วกรอง/แบ่งหน้าใน JS แทน SQL (ต้อง join JSONB metadata->target_id กลับไปเช็ค
  // level ของ user ซึ่ง Kysely เขียน join แบบ dynamic key จาก JSONB ตรงๆ ไม่สะดวก) ยอมรับได้เพราะ
  // จำนวน record ระดับแอดมินทั้งระบบมีน้อยมากเทียบกับ user ทั่วไป ไม่ใช่ hot path ต้องการความไวสูงด้วย
  const candidates = await db
    .selectFrom('audit_logs as al')
    .leftJoin('users as actor', 'actor.id', 'al.user_id')
    .select(['al.id', 'al.event_type', 'al.metadata', 'al.created_at', 'actor.uuid as actor_uuid', 'actor.display_name as actor_display_name'])
    .where('al.event_type', 'in', SQUAD_EVENT_TYPES)
    .orderBy('al.created_at', 'desc')
    .limit(500)
    .execute()

  const targetIds = [
    ...new Set(
      candidates
        .map((c) => (c.metadata as { target_id?: string } | null)?.target_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ].map((id) => BigInt(id))

  const targets = targetIds.length > 0
    ? await db.selectFrom('users').select(['id', 'level', 'u_name', 'display_name']).where('id', 'in', targetIds).execute()
    : []
  const targetMap = new Map(targets.map((t) => [String(t.id), t]))

  const squadOnly = candidates.filter((c) => {
    const targetId = (c.metadata as { target_id?: string } | null)?.target_id
    const target = targetId ? targetMap.get(targetId) : undefined
    return target !== undefined && (SQUAD_MANAGED_LEVELS as readonly number[]).includes(target.level)
  })

  const total = squadOnly.length
  const offset = (page - 1) * limit
  const pageRows = squadOnly.slice(offset, offset + limit)

  return {
    data: pageRows.map((row) => {
      const meta = row.metadata as { target_id?: string; note?: string | null } | null
      const target = meta?.target_id ? targetMap.get(meta.target_id) : undefined
      return {
        id: String(row.id),
        event_type: row.event_type,
        note: meta?.note ?? null,
        created_at: row.created_at,
        actor: row.actor_uuid ? { uuid: row.actor_uuid, display_name: row.actor_display_name } : null,
        target: target ? { u_name: target.u_name, display_name: target.display_name, level: target.level } : null,
      }
    }),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}
