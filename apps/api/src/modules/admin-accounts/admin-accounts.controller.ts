import { status } from 'elysia'
import { countAdminAccounts, findAdminAccounts, insertAdminAccount } from './admin-accounts.service'
import type { adminAccountsQuerySchema, createAdminAccountBodySchema } from './admin-accounts.schema'

export async function getAdminAccounts(query: typeof adminAccountsQuerySchema.static) {
  try {
    const limit = query.limit ?? 20
    const search = query.search?.trim() ?? ''
    const total = await countAdminAccounts(search)
    const totalPages = Math.ceil(total / limit)
    const page = Math.min(query.page ?? 1, Math.max(totalPages, 1))
    const accounts = await findAdminAccounts(page, limit, search)

    return { accounts, pagination: { page, limit, total, totalPages } }
  } catch (error) {
    console.error('Unable to load admin accounts', error)
    return status(500, { message: 'ไม่สามารถโหลดรายการแอดมินได้ กรุณาลองใหม่อีกครั้ง' })
  }
}

export async function createAdminAccount(body: typeof createAdminAccountBodySchema.static) {
  try {
    const passwordHash = await Bun.password.hash(body.password)
    const account = await insertAdminAccount({
      displayName: body.display_name.trim(),
      username: body.username.trim(),
      email: body.email.trim().toLowerCase(),
      passwordHash,
    })
    return status(201, { account })
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : null
    if (code === '23505') {
      return status(409, { message: 'อีเมลหรือ Username นี้ถูกใช้งานแล้ว' })
    }

    console.error('Unable to create admin account', error)
    return status(500, { message: 'ไม่สามารถเพิ่มแอดมินได้ กรุณาลองใหม่อีกครั้ง' })
  }
}
