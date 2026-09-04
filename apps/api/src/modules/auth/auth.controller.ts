import {
  createEmailRegistration,
  RegistrationError,
  verifyEmailRegistration,
} from './auth.service'
import {
  sendVerificationEmail,
  verifyLoginTurnstile,
  verifyRegistrationTurnstile,
} from './auth.integrations'

function registrationErrorResponse(error: unknown) {
  if (error instanceof RegistrationError) {
    return Response.json(
      { message: error.message, field: error.field },
      { status: error.statusCode },
    )
  }

  console.error('Unable to process email registration', error)
  return Response.json(
    { message: 'ไม่สามารถดำเนินการสมัครสมาชิกได้ กรุณาลองใหม่อีกครั้ง' },
    { status: 500 },
  )
}

export async function registerWithEmail(body: {
  username: string
  email: string
  password: string
  turnstile_token?: string
}) {
  if (!(await verifyRegistrationTurnstile(body.turnstile_token))) {
    return Response.json(
      { message: 'ไม่สามารถยืนยัน Cloudflare Turnstile ได้ กรุณาลองใหม่อีกครั้ง', field: 'turnstile_token' },
      { status: 400 },
    )
  }

  try {
    const registration = await createEmailRegistration(
      body.email,
      body.username,
      body.password,
    )

    try {
      await sendVerificationEmail(registration.email, registration.verificationToken)
    } catch (error) {
      console.error('Unable to send registration verification email', error)
      return Response.json(
        { message: 'สร้างคำขอสมัครแล้ว แต่ไม่สามารถส่งอีเมลยืนยันได้ กรุณาลองสมัครใหม่อีกครั้ง' },
        { status: 502 },
      )
    }

    return Response.json(
      { message: 'กรุณาตรวจสอบอีเมลเพื่อยืนยันการสมัครสมาชิก' },
      { status: 201 },
    )
  } catch (error) {
    return registrationErrorResponse(error)
  }
}

export async function requireLoginTurnstile(token: string | undefined) {
  if (await verifyLoginTurnstile(token)) return

  return Response.json(
    { message: 'ไม่สามารถยืนยัน Cloudflare Turnstile ได้ กรุณาลองใหม่อีกครั้ง', field: 'turnstile_token' },
    { status: 400 },
  )
}

export async function confirmRegistrationEmail(token: string) {
  try {
    await verifyEmailRegistration(token)
    return { message: 'ยืนยันอีเมลสำเร็จ' }
  } catch (error) {
    return registrationErrorResponse(error)
  }
}
