import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to,
      subject: 'รีเซ็ตรหัสผ่าน',
      html: `<p>คลิกลิงก์นี้เพื่อรีเซ็ตรหัสผ่าน (หมดอายุใน 1 ชั่วโมง)</p>
             <a href="${resetLink}">${resetLink}</a>`,
    })
  } catch (err) {
    // Development: log แต่ไม่ throw — ให้ flow เดินต่อได้แม้ email ส่งไม่ได้
    console.error('[Email] ส่งไม่ได้:', err)
  }
}