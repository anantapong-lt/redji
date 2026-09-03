import { Globe } from 'lucide-react'

// เดา platform จาก URL แล้วโชว์ icon ของแอปนั้นแทนรูปโลก (Globe) เริ่มต้น — ถ้าเดาไม่ออกก็ใช้
// Globe เหมือนเดิม (fallback) ตามที่ user ขอ ("ถ้าไม่มีก็เป็นแบบปัจจุบันที่เป็นรูปโลก")
//
// หมายเหตุ: lucide-react เวอร์ชันที่ใช้อยู่ตัดไอคอนแบรนด์ (Youtube/Facebook/Instagram/Twitter)
// ออกไปหมดแล้ว (เช็คแล้วตอนทำจุดนี้) จึงวาด path เองแบบง่ายๆ ให้พอจำแบรนด์ได้ ไม่ใช่ asset
// ทางการของแต่ละแอปเป๊ะๆ (ไม่ได้ใช้ icon library แบรนด์แยกเพิ่ม เพื่อไม่ต้องเพิ่ม dependency ใหม่)
export type SocialPlatform = 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'twitter'

export function detectSocialPlatform(url: string): SocialPlatform | null {
  const lower = url.toLowerCase()
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube'
  if (lower.includes('facebook.com') || lower.includes('fb.com')) return 'facebook'
  if (lower.includes('instagram.com')) return 'instagram'
  if (lower.includes('tiktok.com')) return 'tiktok'
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter'
  return null
}

export function SocialIcon({ url, className }: { url: string; className?: string }) {
  const platform = detectSocialPlatform(url)

  switch (platform) {
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.4 3.5 12 3.5 12 3.5s-7.4 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c2 .6 9.4.6 9.4.6s7.4 0 9.4-.6a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.4 3.6-6.4 3.6z" />
        </svg>
      )
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M14 13.5h2.5l.4-3H14V8.7c0-.9.2-1.5 1.5-1.5H17V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4V10.5H8.3v3H10.8V21h3.2v-7.5z" />
        </svg>
      )
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M12 2c-2.7 0-3.1 0-4.1.1-1.1 0-1.8.2-2.4.4-.7.3-1.2.6-1.8 1.2-.6.6-.9 1.1-1.2 1.8-.2.6-.4 1.4-.4 2.4C2 8.9 2 9.3 2 12s0 3.1.1 4.1c0 1.1.2 1.8.4 2.4.3.7.6 1.2 1.2 1.8.6.6 1.1.9 1.8 1.2.6.2 1.4.4 2.4.4 1 .1 1.4.1 4.1.1s3.1 0 4.1-.1c1.1 0 1.8-.2 2.4-.4.7-.3 1.2-.6 1.8-1.2.6-.6.9-1.1 1.2-1.8.2-.6.4-1.4.4-2.4.1-1 .1-1.4.1-4.1s0-3.1-.1-4.1c0-1.1-.2-1.8-.4-2.4-.3-.7-.6-1.2-1.2-1.8-.6-.6-1.1-.9-1.8-1.2-.6-.2-1.4-.4-2.4-.4C15.1 2 14.7 2 12 2zm0 3.2a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 8.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zm5.2-8.4a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4z" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M16.6 5.8a4.5 4.5 0 0 1-3.8-4.2h-3.2v14.4a2.6 2.6 0 1 1-1.8-2.5V10a5.8 5.8 0 1 0 5 5.8V9.5a7.7 7.7 0 0 0 4.5 1.4V7.7a4.5 4.5 0 0 1-.7-1.9z" />
        </svg>
      )
    case 'twitter':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M18.9 3H22l-7.6 8.7L23.3 21H16.4l-5.4-6.6L4.8 21H1.7l8.1-9.3L1 3h7l4.9 6.1L18.9 3zm-1.2 16.2h1.7L7.4 4.7H5.6l12.1 14.5z" />
        </svg>
      )
    default:
      return <Globe className={className} />
  }
}
