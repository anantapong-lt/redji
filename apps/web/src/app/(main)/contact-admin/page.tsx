'use client'

/**
 * app/(main)/contact-admin/page.tsx — หน้า "ติดต่อแอดมิน" (2026-08-18, ใหม่)
 *
 * เดิมเป็น dead link (ไม่เคยมีหน้าจริง มี /contact-admin ผูกไว้แค่ในเนวบาร์/ฟุตเตอร์) — user ขอให้
 * กลายเป็นหน้าโชว์ลิงก์ช่องทางติดต่อภายนอกที่แอดมินตั้งค่าได้ (ดู admin-contact-page.service.ts,
 * แอดมินจัดการที่ apps/admin "ตั้งหน้าเว็บไซต์ > ช่องทางติดต่อ") รวมกับแท็บคำถามที่พบบ่อย
 *
 * ใช้ตาราง web_contacts เดียวกับที่ Footer ใช้อยู่แล้ว (GET /web-contacts, เฉพาะ status=true) —
 * เพจนี้โชว์แบบเต็ม (การ์ด label+ไอคอน) ต่างจาก Footer ที่โชว์แค่ไอคอนกลมๆ เล็กๆ
 *
 * public เข้าถึงได้โดยไม่ต้อง login — ไม่อยู่ใน USER_ROUTES ของ proxy.ts
 */

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, HelpCircle, Mail } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { contactIcon } from '@/lib/contact-icon'

interface WebContact {
  id: string
  label: string
  url: string
  icon_class: string | null
}

interface Faq {
  id: string
  question: string
  answer: string
}

const TABS = [
  { key: 'contacts', label: 'ช่องทางติดต่อ' },
  { key: 'faq', label: 'คำถามที่พบบ่อย' },
] as const
type TabKey = (typeof TABS)[number]['key']

function ContactLinksTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['web-contacts'],
    queryFn: () => api.get<{ data: WebContact[] }>('/web-contacts', { public: true }).then((res) => res.data),
  })

  const contacts = data ?? []

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <p className="py-12 text-center text-sm text-destructive">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>
  }

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Mail className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">ยังไม่มีช่องทางติดต่อ</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {contacts.map((c) => {
        const Icon = contactIcon(c.icon_class)
        return (
          <a
            key={c.id}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-[#d9d9d9] bg-white p-4 transition-all hover:-translate-y-px hover:border-primary/30 hover:shadow-sm"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted" style={{ color: '#b79240' }}>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{c.label}</p>
              <p className="truncate text-xs text-muted-foreground">{c.url}</p>
            </div>
          </a>
        )
      })}
    </div>
  )
}

function FaqTab() {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['faqs'],
    queryFn: () => api.get<{ data: Faq[] }>('/faqs', { public: true }).then((res) => res.data),
  })

  const faqs = data ?? []

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <p className="py-12 text-center text-sm text-destructive">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>
  }

  if (faqs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <HelpCircle className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">ยังไม่มีคำถามที่พบบ่อย</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {faqs.map((f) => {
        const isOpen = expandedId === f.id
        return (
          <div key={f.id} className="overflow-hidden rounded-xl border border-[#d9d9d9] bg-white">
            <button
              type="button"
              onClick={() => setExpandedId(isOpen ? null : f.id)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <span className="font-medium text-foreground">{f.question}</span>
              <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
            </button>
            {isOpen && (
              <div className="border-t border-border/70 px-4 py-3.5">
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{f.answer}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function ContactAdminPage() {
  const [tab, setTab] = useState<TabKey>('contacts')

  // อ่าน ?tab=faq จาก URL ตรงๆ แทน useSearchParams() โดยตั้งใจ (ให้ Footer ลิงก์ตรงไปแท็บ FAQ ได้ —
  // /contact-admin?tab=faq) — useSearchParams() ต้องห่อด้วย <Suspense> และโค้ดฐานนี้มีบั๊กจริงที่ยัง
  // ไม่แก้ (หน้า /search, /gallery ค้างที่ Suspense fallback ตลอดไปเมื่อใช้ hook นี้ — ดู
  // KNOWN_ISSUES.md) เลี่ยงความเสี่ยงเดียวกันโดยอ่าน query string ตรงๆ ฝั่ง client แทน — ทำใน
  // useEffect (ไม่ใช่ lazy useState initializer) กัน hydration mismatch เพราะฝั่ง server render
  // ด้วย tab='contacts' เสมอ (ไม่มี window ตอน SSR) ถ้าอ่านตอน initial render ค่าจะไม่ตรงกับที่
  // server ส่งมาให้ตอนแรก
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'faq') setTab('faq')
  }, [])

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-10">
      <h1 className="mb-2 text-[32px] font-bold text-primary">ติดต่อแอดมิน</h1>
      <p className="mb-6 text-sm text-muted-foreground">ช่องทางติดต่อทีมงาน และคำตอบสำหรับคำถามที่พบบ่อย</p>

      <div className="mb-6 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors',
              tab === t.key
                ? 'bg-primary text-primary-foreground'
                : 'border border-[#d9d9d9] bg-white text-foreground hover:bg-muted',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'contacts' ? <ContactLinksTab /> : <FaqTab />}
    </div>
  )
}
