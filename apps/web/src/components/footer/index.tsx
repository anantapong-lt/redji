'use client'

/**
 * components/footer/index.tsx — Footer หลักของเว็บ (2026-07-30)
 *
 * mount แค่ใน (main)/layout.tsx เท่านั้น — โซนนักเขียน ((writer)/layout.tsx) เป็น dashboard-style
 * ไม่มี Footer อยู่แล้ว เหมือน Navbar เต็มก็ไม่มีในโซนนั้นเช่นกัน (ตั้งใจแยก chrome คนละแบบ)
 *
 * "เติมเหรียญ" ในลิงก์สำรวจชี้ไป /topup — หน้านี้ยังไม่มีอยู่จริง (เหมือน /purchase-history ที่
 * UserMenu ก็ลิงก์ไว้ล่วงหน้าอยู่แล้วเช่นกัน) ตามที่ user ขอให้ใส่ไปก่อนแม้ backend เติมเงินจริง
 * ยังไม่ต่อ — ตรงกับ convention เดิมของโปรเจกต์
 *
 * ช่องทางติดต่อ/โซเชียล (contacts) ดึงจริงจากตาราง web_contacts (มีมาตั้งแต่ migration 001, เพิ่ม
 * admin CRUD จริงแล้วที่ migration 054 — ดู admin-contact-page.service.ts + หน้า /contact-admin)
 * ผ่าน GET /web-contacts — ถ้ายังไม่มีแถวที่ status=true เลย จะซ่อน section นี้ทั้งหมดแทนที่จะโชว์
 * ของปลอม
 *
 * ไม่มีลิงก์ "ข้อกำหนดการใช้งาน"/"นโยบายความเป็นส่วนตัว" ตั้งใจ — เนื้อหาส่วนนี้ user บอกไว้ก่อน
 * หน้านี้ว่าจะ Draft ทีหลัง (ดู KNOWN_ISSUES.md) ยังไม่มีหน้าจริงให้ลิงก์ไป ต่างจาก /topup ที่เป็น
 * ฟีเจอร์ที่วางแผนแน่นอนแล้วแค่ยังไม่ต่อ backend
 *
 * 2026-08-18: user ขอให้เนื้อหาเยอะขึ้น + ใส่หมวดหมู่ให้กดได้ — เพิ่มคอลัมน์ "บัญชี" (ลิงก์หน้าที่
 * ต้อง login — คลิกตอนไม่ได้ login จะโดน proxy.ts เด้งไป /login ให้เองเหมือนลิงก์อื่นในเนวบาร์)
 * และแถบ "หมวดหมู่" แบบ pill ท้ายสุด ดึงจาก GET /categories จริง (เอนด์พอยต์เดียวกับที่หน้าแรกใช้)
 * กรองเฉพาะที่มีเรื่องอยู่จริง (work_count > 0) ไม่โชว์หมวดว่างเปล่า
 */

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Home, Rss, Search, Coins, PenLine, UserRound, UsersRound, History, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { SITE_CONFIG } from '@/site.config'
import { contactIcon } from '@/lib/contact-icon'

interface WebContact {
  id: string
  label: string
  url: string
  icon_class: string | null
}

interface FooterCategory {
  id: string
  name: string
  icon: string | null
  work_count: number
}

const EXPLORE_LINKS = [
  { href: '/', label: 'หน้าแรก', icon: Home },
  { href: '/feed', label: 'ฟีด', icon: Rss },
  { href: '/search', label: 'ค้นหา', icon: Search },
  { href: '/topup', label: 'เติมเหรียญ', icon: Coins },
  { href: '/become-writer', label: 'เป็นนักเขียน', icon: PenLine },
]

const ACCOUNT_LINKS = [
  { href: '/profile', label: 'โปรไฟล์', icon: UserRound },
  { href: '/referral', label: 'ชวนเพื่อน', icon: UsersRound },
  { href: '/purchase-history', label: 'ประวัติการซื้อ', icon: History },
  { href: '/settings', label: 'ตั้งค่า', icon: ShieldCheck },
]

// สีน้ำตาลของแบรนด์ (#471F21) — ใช้ hex ตรงๆ แทน token `bg-primary`/`text-primary` ที่ปกติใช้ทั่ว
// เว็บ เพราะ `--primary` ถูกตั้งให้ "สลับ" เป็นสีขาวเกือบสนิทตอนโหมดมืด (ดู globals.css .dark —
// เอาไว้ให้ปุ่ม/องค์ประกอบ UI ทั่วไปยังอ่านง่ายบนพื้นมืด) ถ้าใช้ token นี้ Footer จะไม่เป็นน้ำตาล
// อีกต่อไปตอนสลับธีมมืด ทั้งที่สีน้ำตาลเป็นสีแบรนด์ที่ควรคงที่เสมอไม่ว่าธีมไหน (เหมือนแถบโลโก้)
//
// ⚠️ ทุก className ด้านล่างต้องเขียนเป็น literal string เต็มๆ ห้ามต่อด้วย template literal
// (เช่น `${CREAM}/70`) — Tailwind สแกนหา class name จาก "ข้อความดิบ" ในไฟล์ source ตรงๆ ไม่ได้
// รัน JS จริง ถ้าต่อ string กันจะไม่เจอ class ที่ต้องสร้างจริง (ไม่มี error ให้เห็นด้วย เงียบๆ
// แค่ไม่ apply สไตล์ — เจอบั๊กนี้เองระหว่างเขียนไฟล์นี้ แก้เป็น literal ทั้งหมดแล้ว)

export function Footer() {
  const { data: contacts = [] } = useQuery({
    queryKey: ['web-contacts'],
    queryFn: () =>
      api.get<{ data: WebContact[] }>('/web-contacts', { public: true }).then((res) => res.data),
    staleTime: 5 * 60 * 1000, // แทบไม่เปลี่ยนเลย — cache ไว้นานหน่อยกันยิงซ้ำทุกหน้า
  })

  // โชว์หมดทุกหมวดที่แอดมินเปิดไว้ (status=true, กรองแล้วตั้งแต่ฝั่ง backend) ตามที่ user ขอ —
  // ไม่กรอง work_count > 0 ซ้ำแบบที่ทำก่อนหน้านี้ ต่างจากแถบหมวดหมู่หน้าแรก (category-row.tsx)
  // ที่ตั้งใจซ่อนหมวดว่างเพราะเป็นพื้นที่จำกัด — Footer มีพื้นที่พอโชว์ครบทุกหมวดได้เลย
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ data: FooterCategory[] }>('/categories', { public: true }).then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <footer className="mt-16 bg-[linear-gradient(135deg,#34181d_0%,#54252b_56%,#713b44_100%)] shadow-[0_-18px_44px_-40px_rgb(45_29_32_/_0.8)]">
      <div className="mx-auto max-w-[1280px] px-4 py-14 md:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* แบรนด์ + ช่องทางติดต่อ */}
          <div className="lg:col-span-2">
            <Link href="/" className="text-2xl font-extrabold tracking-[-0.04em] text-[#F1F1EF] transition-opacity hover:opacity-80">
              {SITE_CONFIG.name}
            </Link>
            <p className="mt-3 max-w-sm text-sm text-[#F1F1EF]/70">{SITE_CONFIG.description}</p>

            {contacts.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {contacts.map((c) => {
                  const Icon = contactIcon(c.icon_class)
                  return (
                    <a
                      key={c.id}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={c.label}
                      title={c.label}
                      className="flex size-10 items-center justify-center rounded-xl border border-[#F1F1EF]/20 bg-white/5 text-[#F1F1EF]/70 transition-all hover:-translate-y-px hover:border-[#F1F1EF]/50 hover:bg-white/10 hover:text-[#F1F1EF]"
                    >
                      <Icon className="size-4" />
                    </a>
                  )
                })}
              </div>
            )}
          </div>

          {/* สำรวจ */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-[#F1F1EF]">สำรวจ</h3>
            <ul className="flex flex-col gap-2.5">
              {EXPLORE_LINKS.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex items-center gap-2 text-sm text-[#F1F1EF]/70 transition-colors hover:translate-x-0.5 hover:text-[#F1F1EF]"
                  >
                    <Icon className="size-4" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* บัญชี — ลิงก์หน้าที่ต้อง login เหมือนกันกับเนวบาร์ (UserMenu) ไม่ได้ login ก็คลิกได้
              ปกติ proxy.ts จะเด้งไป /login ให้เอง เหมือนลิงก์อื่นๆ ในเว็บที่ทำแบบนี้อยู่แล้ว */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-[#F1F1EF]">บัญชี</h3>
            <ul className="flex flex-col gap-2.5">
              {ACCOUNT_LINKS.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex items-center gap-2 text-sm text-[#F1F1EF]/70 transition-colors hover:translate-x-0.5 hover:text-[#F1F1EF]"
                  >
                    <Icon className="size-4" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ช่วยเหลือ */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-[#F1F1EF]">ช่วยเหลือ</h3>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link
                  href="/contact-admin"
                  className="text-sm text-[#F1F1EF]/70 transition-colors hover:translate-x-0.5 hover:text-[#F1F1EF]"
                >
                  ติดต่อแอดมิน
                </Link>
              </li>
              <li>
                <Link
                  href="/contact-admin?tab=faq"
                  className="text-sm text-[#F1F1EF]/70 transition-colors hover:translate-x-0.5 hover:text-[#F1F1EF]"
                >
                  คำถามที่พบบ่อย
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* หมวดหมู่ — ดึงจาก GET /categories จริง (เอนด์พอยต์เดียวกับหน้าแรก) โชว์ครบทุกหมวดที่
            แอดมินเปิดไว้ (ดู comment ตรง useQuery ด้านบน) */}
        {categories.length > 0 && (
          <div className="mt-10 border-t border-[#F1F1EF]/15 pt-8">
            <h3 className="mb-4 text-sm font-semibold text-[#F1F1EF]">หมวดหมู่</h3>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/search?category_main_id=${c.id}`}
                  className="flex items-center gap-1.5 rounded-full border border-[#F1F1EF]/20 bg-white/5 px-3 py-1.5 text-xs text-[#F1F1EF]/70 transition-all hover:-translate-y-px hover:border-[#F1F1EF]/50 hover:bg-white/10 hover:text-[#F1F1EF]"
                >
                  {c.icon && <span>{c.icon}</span>}
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[#F1F1EF]/15">
        <div className="mx-auto max-w-[1280px] px-4 py-5 text-center text-xs text-[#F1F1EF]/60 md:px-8">
          © {new Date().getFullYear()} {SITE_CONFIG.name} สงวนลิขสิทธิ์
        </div>
      </div>
    </footer>
  )
}
