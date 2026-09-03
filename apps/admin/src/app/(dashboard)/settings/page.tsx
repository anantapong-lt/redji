'use client'

/**
 * app/(dashboard)/settings/page.tsx — ตั้งค่า > สิทธิ์การใช้งาน (2026-08-17)
 *
 * ตารางสิทธิ์แบบปรับได้เอง (ฟีลคล้าย Discord role permission) — level 10 ปรับได้เองว่า level 8/9
 * ทำ action ไหนได้บ้าง โดยไม่ต้องแก้โค้ด backend มี permission_matrix table + /admin/permissions
 * พร้อมอยู่แล้ว (ดู admin-permissions.service.ts) หน้านี้แค่โชว์ + แก้ค่า
 *
 * level 10 ติ๊กไม่ได้เลย (เต็มสิทธิ์เสมอโดย design กันเจ้าของเว็บล็อกตัวเองออกจากระบบ) — เห็นเป็นติ๊ก
 * สีเขียวจางๆ ปิด disabled ไว้เฉยๆ ให้เห็นว่า "มีอยู่แล้วเสมอ" ไม่ใช่ปุ่มที่กดได้
 *
 * หมวดหมู่ตอนนี้เรียงเป็น section ยาวในหน้าเดียว — ยังไม่ทำแถบ tab สลับหมวดหมู่ (user ขอไว้ทีหลัง
 * เพราะงานค่อนข้างใหญ่แยกต่างหาก)
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { useAdminUser } from '@/store/auth.store'

interface PermissionAction {
  key: string
  label: string
  description: string | null
  levels: { 8: boolean; 9: boolean; 10: boolean }
}

interface PermissionCategory {
  category: string
  actions: PermissionAction[]
}

const CATEGORY_LABEL: Record<string, string> = {
  economy: 'เศรษฐกิจ',
  moderation: 'จัดการผู้ใช้',
  squad: 'หน่วยรบ',
  content: 'เนื้อหา/ผลงาน',
  tts: 'TTS',
  system: 'ระบบ',
}

export default function SettingsPage() {
  const me = useAdminUser()
  const myLevel = me?.level ?? 0

  if (myLevel < 10) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">ตั้งค่า</h1>
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          เข้าได้เฉพาะ Shareholder (level 10) เท่านั้น
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-foreground">ตั้งค่า</h1>
      <p className="mb-6 text-sm text-muted-foreground">สิทธิ์การใช้งาน — เปิด/ปิดว่าแอดมิน level 8/9 ทำอะไรได้บ้าง โดยไม่ต้องแก้โค้ด</p>
      <PermissionMatrixSection />
    </div>
  )
}

function PermissionMatrixSection() {
  const queryClient = useQueryClient()
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'permission-matrix'],
    queryFn: () => api.get<{ categories: PermissionCategory[] }>('/admin/permissions'),
  })

  const categories = query.data?.categories ?? []

  async function toggle(actionKey: string, level: 8 | 9, allowed: boolean) {
    setError(null)
    setPendingKey(`${actionKey}:${level}`)
    try {
      await api.patch(`/admin/permissions/${actionKey}`, { level, allowed })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'permission-matrix'] })
    } catch (err: any) {
      setError(err?.message ?? 'ปรับสิทธิ์ไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setPendingKey(null)
    }
  }

  if (query.isLoading) {
    return <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-500" />
        <span>
          ติ๊ก = อนุญาตให้ level นั้นทำ action นี้ได้ — <b className="text-foreground">level 10 เต็มสิทธิ์เสมอทุก action</b> (ปรับไม่ได้ กันล็อกตัวเองออกจากระบบ)
          เปลี่ยนแล้วมีผลทันที ไม่ต้อง deploy ใหม่
        </span>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {categories.map((cat) => (
        <div key={cat.category} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-foreground">{CATEGORY_LABEL[cat.category] ?? cat.category}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">การกระทำ</th>
                <th className="w-16 px-2 py-2 text-center font-medium">Lvl 8</th>
                <th className="w-16 px-2 py-2 text-center font-medium">Lvl 9</th>
                <th className="w-16 px-2 py-2 text-center font-medium">Lvl 10</th>
              </tr>
            </thead>
            <tbody>
              {cat.actions.map((action) => (
                <tr key={action.key} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-foreground">{action.label}</div>
                    {action.description && <div className="text-xs text-muted-foreground">{action.description}</div>}
                  </td>
                  {([8, 9] as const).map((level) => (
                    <td key={level} className="px-2 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={action.levels[level]}
                        disabled={pendingKey === `${action.key}:${level}`}
                        onChange={(e) => toggle(action.key, level, e.target.checked)}
                        className="size-4 cursor-pointer disabled:cursor-wait disabled:opacity-50"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-center">
                    <input type="checkbox" checked disabled className="size-4 accent-emerald-600 opacity-60" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
