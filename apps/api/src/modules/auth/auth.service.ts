import { hash, verify } from '@node-rs/argon2'
import { uuidv7 } from 'uuidv7'
import crypto from 'crypto'
import { db } from '../../db'
import { sendPasswordResetEmail } from '../../lib/email'

// argon2id config — ตัวเลขพวกนี้กำหนดความแข็งแกร่งในการ hash
// memoryCost สูง = brute force ยากขึ้น เพราะต้องใช้ RAM เยอะ
const ARGON2_OPTIONS = {
  memoryCost: 65536, // 64MB
  timeCost: 3,
  parallelism: 4,
}

// ---- Register ----
export async function registerUser(input: {
  u_name: string
  display_name: string
  email: string
  password: string
  ref_code?: string
}) {
  // เช็ค email และ username ซ้ำในครั้งเดียว (1 query แทน 2)
  const existing = await db
    .selectFrom('users')
    .select(['email', 'u_name'])
    .where((eb) =>
      eb.or([
        eb('email', '=', input.email.toLowerCase()),
        eb('u_name', '=', input.u_name),
      ])
    )
    .executeTakeFirst()

  if (existing?.email === input.email.toLowerCase()) {
    throw new Error('EMAIL_TAKEN')
  }
  if (existing?.u_name === input.u_name) {
    throw new Error('USERNAME_TAKEN')
  }

  // Hash ด้วย argon2id — ห้ามเปลี่ยนเป็น bcrypt หรืออื่น
  const password_hash = await hash(input.password, ARGON2_OPTIONS)

  // หา referrer จาก ref_code (ถ้าส่งมา) — referral_code เป็นของ writer เท่านั้น
  // (auto-gen ตอนได้รับอนุมัติเป็นนักเขียน — ระบบนั้นยังไม่มี UI ให้ขอ/อนุมัติจริงตอนนี้
  // ดู KNOWN_ISSUES.md) โค้ดที่ไม่ตรงกับ writer คนไหนเลย (พิมพ์ผิด/หมดอายุ) ไม่บล็อกการ
  // สมัคร แค่ไม่ผูก referred_by ให้เฉยๆ
  let referredBy: bigint | null = null
  if (input.ref_code) {
    const referrer = await db
      .selectFrom('users')
      .select('id')
      .where('referral_code', '=', input.ref_code)
      .executeTakeFirst()
    referredBy = referrer?.id ?? null
  }

  const user = await db
    .insertInto('users')
    .values({
      uuid: uuidv7(),
      u_name: input.u_name,
      display_name: input.display_name,
      email: input.email.toLowerCase(),
      password_hash,
      level: 1,
      referred_by: referredBy,
      // ไม่ต้องใส่ auto_ep_purchase, load_all_images, password_legacy
      // เพราะ SQL มี DEFAULT false ให้อยู่แล้ว
    })
    .returning(['id', 'uuid', 'u_name', 'display_name', 'email', 'level'])
    .executeTakeFirstOrThrow()

  return user
}

// ---- Login ----
export async function loginUser(input: {
  login: string
  password: string
}) {
  // login รับได้ทั้ง username หรือ email
  const user = await db
    .selectFrom('users')
    .selectAll()
    .where((eb) =>
      eb.or([
        eb('email', '=', input.login.toLowerCase()),
        eb('u_name', '=', input.login),
      ])
    )
    .executeTakeFirst()

  // ใช้ error message เดียวกันทั้ง "ไม่เจอ user" และ "password ผิด"
  // ป้องกัน attacker รู้ว่า email นี้มีในระบบหรือเปล่า (user enumeration)
  if (!user) throw new Error('INVALID_CREDENTIALS')

  const valid = await verify(user.password_hash, input.password)
  if (!valid) throw new Error('INVALID_CREDENTIALS')

  // ลบ field ลับออกก่อน return — ห้ามส่ง password_hash หรือ google_token ออกไปเด็ดขาด
  const { password_hash, google_token, ...safeUser } = user
  return safeUser
}

// ---- บันทึกประวัติ login (migration 026) — โครงเปล่าๆ เก็บ raw data ก่อนตาม user ขอ ยังไม่มี
// หน้า admin ดู/วิเคราะห์อะไรเลย เรียกจาก auth.routes.ts เพราะต้องใช้ request headers (IP/user-agent)
// ที่ดึงได้ง่ายสุดตรงชั้น route — ห้ามให้ error จากฟังก์ชันนี้ทำให้ login พังไปด้วย (แค่ log เสริม
// ไม่ใช่ core flow) เลยให้ผู้เรียกเป็นคน try/catch ครอบเอง ไม่ throw ออกไปตรงๆ ในนี้
export async function recordLoginHistory(params: {
  userId: bigint | null
  identifier: string
  success: boolean
  ipAddress: string | null
  userAgent: string | null
}) {
  await db
    .insertInto('login_history')
    .values({
      user_id:    params.userId,
      identifier: params.identifier,
      success:    params.success,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    })
    .execute()
}

// ---- Get current user (สำหรับ /auth/me) ----
export async function getUserById(id: string) {
  const user = await db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', BigInt(id))
    .executeTakeFirst()

  if (!user) throw new Error('USER_NOT_FOUND')

  const { password_hash, google_token, ...safeUser } = user
  return safeUser
}

// ---- Forgot Password ----
export async function forgotPassword(email: string) {
  const user = await db
    .selectFrom('users')
    .select(['id', 'email'])
    .where('email', '=', email.toLowerCase())
    .executeTakeFirst()

  // ไม่บอกว่าเจอ email หรือเปล่า — ป้องกัน user enumeration
  // ถึงไม่เจอก็ return โดยไม่ throw เพื่อให้ response เหมือนกัน
  if (!user) return

  // สร้าง token แบบ random ปลอดภัย — 64 hex characters
  const token = crypto.randomBytes(32).toString('hex')
  const expires_at = new Date(Date.now() + 1000 * 60 * 60) // หมดอายุใน 1 ชั่วโมง

  // ลบ token เก่าของ user นี้ออกก่อน ถ้ามี — ไม่ให้มีหลาย token ค้างอยู่
  await db
    .deleteFrom('password_reset_tokens')
    .where('user_id', '=', user.id)
    .execute()

  // สร้าง token ใหม่
  await db
    .insertInto('password_reset_tokens')
    .values({ user_id: user.id, token, expires_at })
    .execute()

  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`
  await sendPasswordResetEmail(user.email, resetLink)
}

// ---- Reset Password ----
export async function resetPassword(token: string, newPassword: string) {
  const record = await db
    .selectFrom('password_reset_tokens')
    .selectAll()
    .where('token', '=', token)
    .where('used_at', 'is', null)           // ยังไม่ถูกใช้
    .where('expires_at', '>', new Date())   // ยังไม่หมดอายุ
    .executeTakeFirst()

  if (!record) throw new Error('TOKEN_INVALID')

  // Hash password ใหม่ด้วย argon2id เหมือนเดิม
  const password_hash = await hash(newPassword, ARGON2_OPTIONS)

  // อัปเดต password และ mark token ว่าใช้แล้ว — ทำพร้อมกันด้วย Promise.all
  // token ที่ใช้แล้วจะใช้ซ้ำไม่ได้อีก แม้ยังไม่หมดอายุ
  await Promise.all([
    db
      .updateTable('users')
      .set({ password_hash, updated_at: new Date() })
      .where('id', '=', record.user_id)
      .execute(),

    db
      .updateTable('password_reset_tokens')
      .set({ used_at: new Date() })
      .where('id', '=', record.id)
      .execute(),
  ])
}

// ---- Change Password (ตอน login อยู่แล้ว) — ต่างจาก resetPassword ที่ผ่าน email token
// เพราะยังไม่ได้ผูกบริการอีเมลไว้กู้คืน (2026-08-18) ต้องพิมพ์รหัสผ่านเดิมยืนยันตัวตนแทน ----
export async function changePassword(userId: bigint, currentPassword: string, newPassword: string) {
  const user = await db.selectFrom('users').select(['password_hash']).where('id', '=', userId).executeTakeFirst()
  if (!user) throw new Error('USER_NOT_FOUND')

  const valid = await verify(user.password_hash, currentPassword)
  if (!valid) throw new Error('CURRENT_PASSWORD_INCORRECT')

  const password_hash = await hash(newPassword, ARGON2_OPTIONS)
  await db.updateTable('users').set({ password_hash, updated_at: new Date() }).where('id', '=', userId).execute()
}