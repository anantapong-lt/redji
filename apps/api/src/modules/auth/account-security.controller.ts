import { getAccountSecurity } from './account-security.service'

export async function accountSecurityResponse(userId: string) {
  const account = await getAccountSecurity(userId)
  if (!account) return Response.json({ message: 'ไม่พบบัญชีผู้ใช้' }, { status: 404 })
  return { account }
}
