import { verifyPhoneVerificationTurnstile } from './auth.integrations'
import { PhoneOtpProviderError, changeAccountPassword, getAccountSecurity, requestPhoneVerification, setAccountPassword, unlinkGoogleAccount, verifyPhoneVerification } from './account-security.service'
import type { ChangePasswordBody, PhoneVerificationRequestBody, PhoneVerificationVerifyBody, SetPasswordBody, UnlinkGoogleBody } from './auth.schema'

function thaiPhoneNumber(phoneNumber: string): string {
  return `+66${phoneNumber.slice(1)}`
}

export async function accountSecurityResponse(userId: string) {
  const account = await getAccountSecurity(userId)
  if (!account) return Response.json({ message: 'ไม่พบบัญชีผู้ใช้' }, { status: 404 })
  return { account }
}

export async function accountSecuritySessionResponse(userId: string | undefined) {
  if (!userId) return Response.json({ message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
  return accountSecurityResponse(userId)
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

export async function setPasswordResponse(userId: string, body: SetPasswordBody) {
  if (body.new_password !== body.confirm_password) {
    return Response.json({ message: 'ยืนยันรหัสผ่านไม่ตรงกัน', field: 'confirm_password' }, { status: 400 })
  }

  try {
    const result = await setAccountPassword(userId, body.new_password)
    if (result === 'inactive') {
      return Response.json({ message: 'บัญชีนี้ไม่สามารถเข้าใช้งานได้' }, { status: 403 })
    }
    if (result === 'already_set') {
      return Response.json({ message: 'บัญชีนี้มีรหัสผ่านอยู่แล้ว กรุณาใช้เมนูเปลี่ยนรหัสผ่าน' }, { status: 409 })
    }
    return { message: 'ตั้งรหัสผ่านสำเร็จแล้ว' }
  } catch {
    return Response.json({ message: 'ไม่สามารถตั้งรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 })
  }
}

export async function unlinkGoogleResponse(userId: string, body: UnlinkGoogleBody) {
  try {
    const result = await unlinkGoogleAccount(userId, body.current_password)
    if (result === 'invalid_password') {
      return Response.json({ message: 'รหัสผ่านไม่ถูกต้อง', field: 'current_password' }, { status: 400 })
    }
    if (result === 'no_password') {
      return Response.json({ message: 'บัญชีนี้ยังไม่มีรหัสผ่าน จึงไม่สามารถยกเลิกการเชื่อม Google ได้' }, { status: 400 })
    }
    if (result === 'not_linked') {
      return Response.json({ message: 'ไม่พบบัญชี Google ที่เชื่อมต่ออยู่' }, { status: 404 })
    }
    return { message: 'ยกเลิกการเชื่อมบัญชี Google สำเร็จแล้ว' }
  } catch {
    return Response.json({ message: 'ไม่สามารถยกเลิกการเชื่อมบัญชี Google ได้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 })
  }
}

export async function requestPhoneVerificationResponse(userId: string, body: PhoneVerificationRequestBody) {
  if (!(await verifyPhoneVerificationTurnstile(body.turnstile_token))) {
    return Response.json({ message: 'กรุณายืนยัน Cloudflare Turnstile ก่อนขอรหัส OTP', field: 'turnstile_token' }, { status: 400 })
  }

  try {
    const result = await requestPhoneVerification(userId, thaiPhoneNumber(body.phone_number))
    if (result === 'inactive') return Response.json({ message: 'บัญชีนี้ไม่สามารถเข้าใช้งานได้' }, { status: 403 })
    if (result === 'phone_in_use') return Response.json({ message: 'เบอร์มือถือถูกใช้งานกับบัญชีอื่นแล้ว', field: 'phone_number' }, { status: 409 })
    return { message: 'ส่งรหัส OTP แล้ว กรุณากรอกเพื่อยืนยันเบอร์มือถือ' }
  } catch (error) {
    if (error instanceof PhoneOtpProviderError) {
      if (error.reason === 'not_configured') {
        return Response.json({ message: 'ยังไม่ได้ตั้งค่า BoostSMS API Key สำหรับ SMS OTP', field: 'phone_number' }, { status: 503 })
      }
      if (error.reason === 'rejected') {
        if (error.providerStatus === 402 || error.providerStatus === 423) {
          return Response.json({ message: 'เครดิต SMS OTP ไม่เพียงพอ กรุณาเติมเครดิตใน BoostSMS', field: 'phone_number' }, { status: 402 })
        }
        if (error.providerStatus === 429) {
          return Response.json({ message: 'ขอรหัส OTP บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่', field: 'phone_number' }, { status: 429 })
        }
        if (error.providerStatus === 401 || error.providerStatus === 403) {
          return Response.json({ message: 'การตั้งค่า BoostSMS API Key ไม่ถูกต้องหรือยังไม่ได้เปิดสิทธิ์ใช้งาน', field: 'phone_number' }, { status: 503 })
        }
        return Response.json({ message: 'BoostSMS ปฏิเสธคำขอ OTP กรุณาตรวจสอบเบอร์โทรและการเปิดใช้งาน SMS OTP', field: 'phone_number' }, { status: 400 })
      }
      return Response.json({ message: 'ระบบส่ง OTP ยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง' }, { status: 503 })
    }
    return Response.json({ message: 'ไม่สามารถส่งรหัส OTP ได้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 })
  }
}

export async function verifyPhoneVerificationResponse(userId: string, body: PhoneVerificationVerifyBody) {
  try {
    const result = await verifyPhoneVerification(userId, thaiPhoneNumber(body.phone_number), body.otp)
    if (result === 'inactive') return Response.json({ message: 'บัญชีนี้ไม่สามารถเข้าใช้งานได้' }, { status: 403 })
    if (result === 'phone_in_use') return Response.json({ message: 'เบอร์มือถือถูกใช้งานกับบัญชีอื่นแล้ว', field: 'phone_number' }, { status: 409 })
    if (result === 'expired') return Response.json({ message: 'รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่' }, { status: 400 })
    if (result === 'invalid_otp') return Response.json({ message: 'รหัส OTP ไม่ถูกต้อง', field: 'otp' }, { status: 400 })
    return { message: 'ยืนยันเบอร์มือถือสำเร็จแล้ว', phone_number: thaiPhoneNumber(body.phone_number) }
  } catch (error) {
    if (error instanceof PhoneOtpProviderError) {
      return Response.json({ message: 'ระบบยืนยัน OTP ยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง' }, { status: 503 })
    }
    return Response.json({ message: 'ไม่สามารถยืนยันเบอร์มือถือได้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 })
  }
}
