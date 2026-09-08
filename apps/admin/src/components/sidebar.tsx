'use client'

import Link from 'next/link'
import { Banknote, BarChart3, BookOpen, ClipboardCheck, Flag, History, LayoutTemplate, LogOut, MessageSquare, PenSquare, ShieldCheck, UserCog, Users, Volume2 } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useAdminAuth } from '@/components/admin-auth-provider'
import { Button } from '@/components/ui/button'
import { Sidebar as SidebarPrimitive, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

const navigation = [
  { label: 'ภาพรวม', items: [{ href: '/dashboard', label: 'Dashboard', icon: BarChart3 }, { href: '/reports', label: 'รายงาน', icon: Flag }] },
  { label: 'จัดการเนื้อหา', items: [{ href: '/works', label: 'ผลงานทั้งหมด', icon: BookOpen }, { href: '/tts-requests', label: 'คำขอ TTS', icon: Volume2 }, { href: '/messages', label: 'ข้อความติดต่อ', icon: MessageSquare }] },
  { label: 'จัดการผู้ใช้งาน', items: [{ href: '/users', label: 'ผู้ใช้งาน', icon: Users }, { href: '/writer-applications', label: 'คำขอเป็นนักเขียน', icon: ClipboardCheck }, { href: '/writers', label: 'นักเขียน', icon: PenSquare }, { href: '/admin-account', label: 'บัญชีแอดมิน', icon: UserCog }] },
  { label: 'การเงิน', items: [{ href: '/transactions', label: 'คำขอถอน', icon: Banknote }, { href: '/history', label: 'ประวัติ', icon: History }] },
  { label: 'ระบบ', items: [{ href: '/site', label: 'ตั้งค่าเว็บไซต์', icon: LayoutTemplate }] },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const { logout } = useAdminAuth()

  return <SidebarPrimitive>
    <SidebarHeader><SidebarMenu><SidebarMenuItem><SidebarMenuButton size="lg"><div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><ShieldCheck className="size-4" /></div><div className="grid flex-1 text-left text-sm leading-tight"><span className="truncate font-semibold">Readji Admin</span><span className="truncate text-xs text-sidebar-foreground/70">CONTROL CENTER</span></div></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarHeader>
    <SidebarContent>{navigation.map(({ label, items }) => <SidebarGroup key={label}><SidebarGroupLabel>{label}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{items.map(({ href, label: itemLabel, icon: Icon }) => {
      const isActive = pathname === href
      return <SidebarMenuItem key={href}><SidebarMenuButton isActive={isActive} render={<Link href={href} />} className={isActive ? '!bg-primary !text-white hover:!bg-primary/90 [&_svg]:!text-white' : ''}><Icon />{itemLabel}</SidebarMenuButton></SidebarMenuItem>
    })}</SidebarMenu></SidebarGroupContent></SidebarGroup>)}</SidebarContent>
    <SidebarFooter><Button variant="outline" onClick={() => void logout()}><LogOut />ออกจากระบบ</Button></SidebarFooter>
  </SidebarPrimitive>
}
