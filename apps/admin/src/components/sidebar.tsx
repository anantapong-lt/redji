'use client'

import Link from 'next/link'
import { Banknote, BarChart3, BookOpen, Flag, History, LayoutTemplate, LogOut, MessageSquare, PenSquare, Swords, UserCog, Users, Volume2 } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useAdminAuth } from '@/components/admin-auth-provider'
import { Button } from '@/components/ui/button'
import { Sidebar as SidebarPrimitive, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

const navigation = [
  { href: '/site', label: 'ตั้งค่าเว็บไซต์', icon: LayoutTemplate }, { href: '/analytics', label: 'Analytics', icon: BarChart3 }, { href: '/users', label: 'ผู้ใช้งาน', icon: Users }, { href: '/writers', label: 'นักเขียน', icon: PenSquare }, { href: '/works', label: 'ผลงาน', icon: BookOpen }, { href: '/tts-requests', label: 'คำขอ TTS', icon: Volume2 }, { href: '/reports', label: 'รายงาน', icon: Flag }, { href: '/messages', label: 'ข้อความติดต่อ', icon: MessageSquare }, { href: '/squad', label: 'หน่วยรบ', icon: Swords }, { href: '/admin-account', label: 'บัญชีแอดมิน', icon: UserCog }, { href: '/transactions', label: 'ธุรกรรม', icon: Banknote }, { href: '/history', label: 'ประวัติ', icon: History },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const { logout } = useAdminAuth()

  return <SidebarPrimitive>
    <SidebarHeader><p className="text-xs font-semibold tracking-widest text-primary">CONTROL CENTER</p><p className="text-lg font-semibold">Readji Admin</p></SidebarHeader>
    <SidebarContent><SidebarGroup><SidebarGroupLabel>เมนู</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{navigation.map(({ href, label, icon: Icon }) => <SidebarMenuItem key={href}><SidebarMenuButton isActive={pathname === href} render={<Link href={href} />}><Icon />{label}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent>
    <SidebarFooter><Button variant="outline" onClick={() => void logout()}><LogOut />ออกจากระบบ</Button></SidebarFooter>
  </SidebarPrimitive>
}
