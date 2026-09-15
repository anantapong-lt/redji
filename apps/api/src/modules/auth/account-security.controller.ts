import { changeAccountPassword, getAccountSecurity } from './account-security.service'
import type { ChangePasswordBody } from './auth.schema'

export async function accountSecurityResponse(userId: string) {
  const account = await getAccountSecurity(userId)
  if (!account) return Response.json({ message: 'ไม่พบบัญชีผู้ใช้' }, { status: 404 })
  return { account }
}

export async function changePasswordResponse(userId: string, body: ChangePasswordBody) {
  if (body.new_password !== body.confirm_password) {
    return Response.json({ message: 'ยืนยันรหัสผ่านใหม่ไม่ตรงกัน', field: 'confirm_password' }, { status: 400 })
  }
  if (body.current_password === body.new_password) {
    return Response.json({ message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม', field: 'new_password' }, { status: 400 })
  }

  try {
    const result = await changeAccountPassword(userId, body.current_password, body.new_password)
    if (result === 'invalid_password') {
      return Response.json({ message: 'รหัสผ่านเดิมไม่ถูกต้อง', field: 'current_password' }, { status: 400 })
    }
    if (result === 'no_password') {
      return Response.json({ message: 'บัญชีนี้ยังไม่มีรหัสผ่านสำหรับเข้าสู่ระบบ กรุณาเข้าสู่ระบบด้วย Google' }, { status: 400 })
    }
    if (result === 'conflict') {
      return Response.json({ message: 'ข้อมูลบัญชีมีการเปลี่ยนแปลง กรุณาลองใหม่อีกครั้ง' }, { status: 409 })
    }
    return { message: 'เปลี่ยนรหัสผ่านสำเร็จแล้ว' }
  } catch {
    return Response.json({ message: 'ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 })
  }
}
