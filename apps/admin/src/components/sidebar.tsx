'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Banknote,
  BarChart3,
  BookOpen,
  Flag,
  History,
  LayoutTemplate,
  MessageSquare,
  PenSquare,
  Swords,
  UserCog,
  Users,
  Volume2,
} from 'lucide-react'

const navigation = [
  { href: '/site', label: 'ตั้งค่าหน้าเว็บไซต์', icon: LayoutTemplate },
  { href: '/analytics', label: 'Analytic', icon: BarChart3 },
  { href: '/users', label: 'ผู้ใช้ทั้งหมด', icon: Users },
  { href: '/writers', label: 'นักเขียน', icon: PenSquare },
  { href: '/works', label: 'ผลงานทั้งหมด', icon: BookOpen },
  { href: '/tts-requests', label: 'คำขอใช้ TTS', icon: Volume2 },
  { href: '/reports', label: 'รายงาน', icon: Flag },
  { href: '/messages', label: 'ข้อความติดต่อ', icon: MessageSquare },
  { href: '/squad', label: 'หน่วยรบ', icon: Swords },
  { href: '/admin-account', label: 'ข้อมูลบัญชีแอดมิน', icon: UserCog },
  { href: '/transactions', label: 'จัดการธุรกรรม', icon: Banknote },
  { href: '/history', label: 'ประวัติ', icon: History },
] as const

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <p>CONTROL CENTER</p>
        <h1>Readji Admin</h1>
      </div>

      <nav className="sidebar-nav" aria-label="เมนูผู้ดูแลระบบ">
        {navigation.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href

          return (
            <Link
              key={href}
              href={href}
              className="sidebar-link"
              data-active={isActive || undefined}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon aria-hidden="true" strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="sidebar-level">level 9</div>
    </aside>
  )
}
