import { Mail, MessageCircle, Globe, type LucideIcon } from 'lucide-react'

/**
 * lib/contact-icon.ts — แปลง web_contacts.icon_class → ไอคอน Lucide (2026-08-18)
 * แยกออกมาจาก footer/index.tsx ให้ใช้ร่วมกับหน้า "ติดต่อแอดมิน" ได้ — lucide-react เวอร์ชันที่ใช้
 * ในโปรเจกต์นี้ (1.16.0) ตัดไอคอนแบรนด์ (Facebook/Discord/ฯลฯ) ออกไปแล้ว เหลือแต่ไอคอนทั่วไป
 * เลย map จาก icon_class ที่พอเดา keyword ได้ ที่เหลือ fallback เป็นไอคอนโลก (ลิงก์ทั่วไป)
 */
export function contactIcon(iconClass: string | null): LucideIcon {
  const key = (iconClass ?? '').toLowerCase()
  if (key.includes('line') || key.includes('chat') || key.includes('message')) return MessageCircle
  if (key.includes('mail') || key.includes('email')) return Mail
  return Globe
}
