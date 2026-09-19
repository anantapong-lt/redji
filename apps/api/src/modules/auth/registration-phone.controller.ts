import { PhoneOtpProviderError } from './account-security.service'
import { verifyPhoneVerificationTurnstile, verifyRegistrationTurnstile } from './auth.integrations'
import { requestRegistrationPhoneOtp, verifyRegistrationPhoneOtp } from './registration-phone.service'

type PhoneRequest = { phone_number: string; turnstile_token?: string }
type PhoneVerify = { verification_id: string; otp: string }

function providerError(error: PhoneOtpProviderError): Response {
  if (error.reason === 'not_configured') return Response.json({ message: 'ยังไม่ได้ตั้งค่า BoostSMS API Key', field: 'phone_number' }, { status: 503 })
  if (error.providerStatus === 402) return Response.json({ message: 'เครดิต SMS OTP ไม่เพียงพอ', field: 'phone_number' }, { status: 402 })
  if (error.providerStatus === 429) return Response.json({ message: 'ขอรหัส OTP บ่อยเกินไป กรุณารอแล้วลองใหม่', field: 'phone_number' }, { status: 429 })
  if (error.providerStatus === 401 || error.providerStatus === 403) return Response.json({ message: 'การตั้งค่า BoostSMS API Key ไม่ถูกต้อง', field: 'phone_number' }, { status: 503 })
  return Response.json({ message: 'ระบบ OTP ยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง' }, { status: 503 })
}

async function requestRegistrationPhone(body: PhoneRequest, verifyTurnstile: (token: string | undefined) => Promise<boolean>) {
  if (!(await verifyTurnstile(body.turnstile_token))) {
    return Response.json({ message: 'กรุณายืนยัน Cloudflare Turnstile ก่อนขอรหัส OTP', field: 'turnstile_token' }, { status: 400 })
  }
  try {
    const result = await requestRegistrationPhoneOtp(body.phone_number)
    return { message: 'ส่งรหัส OTP แล้ว', verification_id: result.verificationId, expires_in: result.expiresIn }
  } catch (error) {
    if (error === 'phone_in_use') return Response.json({ message: 'เบอร์มือถือถูกใช้งานกับบัญชีอื่นแล้ว', field: 'phone_number' }, { status: 409 })
    if (error instanceof PhoneOtpProviderError) return providerError(error)
    console.error('Unable to send registration phone OTP', error)
    return Response.json({ message: 'ไม่สามารถส่งรหัส OTP ได้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 })
  }
}

/** First OTP is authorized by the registration challenge submitted with the form. */
export function startRegistrationPhoneResponse(body: PhoneRequest) {
  return requestRegistrationPhone(body, verifyRegistrationTurnstile)
}

/** Resends have their own phone-verification Turnstile challenge. */
export function requestRegistrationPhoneResponse(body: PhoneRequest) {
  return requestRegistrationPhone(body, verifyPhoneVerificationTurnstile)
}

export async function verifyRegistrationPhoneResponse(body: PhoneVerify) {
  try {
    const result = await verifyRegistrationPhoneOtp(body.verification_id, body.otp)
    if (result === 'phone_in_use') return Response.json({ message: 'เบอร์มือถือถูกใช้งานกับบัญชีอื่นแล้ว', field: 'phone_number' }, { status: 409 })
    if (result === 'expired') return Response.json({ message: 'รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่', field: 'otp' }, { status: 410 })
    if (result === 'invalid_otp') return Response.json({ message: 'รหัส OTP ไม่ถูกต้อง', field: 'otp' }, { status: 400 })
    return { message: 'ยืนยันเบอร์มือถือสำเร็จ', verification_token: result.verificationToken }
  } catch (error) {
    if (error instanceof PhoneOtpProviderError) return providerError(error)
    console.error('Unable to verify registration phone OTP', error)
    return Response.json({ message: 'ไม่สามารถยืนยันรหัส OTP ได้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 })
  }
}
