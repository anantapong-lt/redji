'use client'

/**
 * app/(main)/settings/page.tsx — หน้าตั้งค่าบัญชี (login only — ดู proxy.ts USER_ROUTES)
 *
 * เปิดจากปุ่ม "ตั้งค่า" ข้างปุ่ม "แก้ไข" ในหน้าโปรไฟล์ตัวเอง — ต่างจาก EditProfileDialog ที่แก้
 * ข้อมูลสาธารณะ (รูป/ชื่อ/bio/โซเชียล) เพราะหน้านี้เป็นเรื่อง "ความปลอดภัยบัญชี" ล้วนๆ (รหัสผ่าน +
 * ดูว่าล็อกอินไว้ที่ไหนบ้าง) 2026-08-18: ยังไม่ได้ผูกบริการอีเมลกู้คืนรหัสผ่าน เลยเปลี่ยนรหัสผ่าน
 * ต้องพิมพ์รหัสผ่านเดิมยืนยันตัวตนแทน (คนละ flow กับ /forgot-password ที่ผ่าน token ทางอีเมล)
 */

import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { KeyRound, ShieldCheck, ChevronLeft, ChevronRight, MonitorSmartphone, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatThaiDateTime } from '@/lib/utils'
import { parseUserAgent } from '@/lib/parse-user-agent'

const HISTORY_PAGE_SIZE = 20

interface LoginHistoryRow {
  id: string
  success: boolean
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

interface LoginHistoryResponse {
  data: LoginHistoryRow[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

const inputClass =
  'h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน')
      return
    }

    setSaving(true)
    try {
      await api.patch('/auth/me/password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err?.message ?? 'เปลี่ยนรหัสผ่านไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-[20px] bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-1 flex items-center gap-2">
        <KeyRound className="size-5" style={{ color: '#b79240' }} />
        <h2 className="text-lg font-bold text-black">เปลี่ยนรหัสผ่าน</h2>
      </div>
      <p className="mb-5 text-xs text-muted-foreground">
        ระบบยังไม่ได้ผูกบริการอีเมลกู้คืนรหัสผ่าน — ต้องพิมพ์รหัสผ่านปัจจุบันเพื่อยืนยันตัวตนก่อนเปลี่ยนทุกครั้ง
      </p>

      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3.5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">รหัสผ่านปัจจุบัน</label>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => { setCurrentPassword(e.target.value); setError('') }}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">รหัสผ่านใหม่</label>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setError('') }}
            required
            minLength={8}
            maxLength={72}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">ยืนยันรหัสผ่านใหม่</label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
            required
            className={inputClass}
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <Button type="submit" disabled={saving} className="mt-1 w-fit rounded-full px-6">
          {saving ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
        </Button>
      </form>
    </section>
  )
}

function LoginHistorySection() {
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', 'me', 'login-history', page],
    queryFn: () => api.get<LoginHistoryResponse>(`/users/me/login-history?page=${page}&limit=${HISTORY_PAGE_SIZE}`),
  })

  const rows = data?.data ?? []
  const totalPages = data?.pagination.pages ?? 1

  return (
    <section className="rounded-[20px] bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck className="size-5" style={{ color: '#b79240' }} />
        <h2 className="text-lg font-bold text-black">ประวัติการเข้าสู่ระบบ</h2>
      </div>
      <p className="mb-5 text-xs text-muted-foreground">ตรวจสอบว่าบัญชีของคุณเคยเข้าสู่ระบบไว้ที่ไหนบ้าง</p>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-8 text-center text-sm text-destructive">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีประวัติการเข้าสู่ระบบ</p>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-border/70">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center gap-3 py-3">
                <span className={row.success ? 'text-emerald-500' : 'text-destructive'}>
                  {row.success ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
                </span>
                <MonitorSmartphone className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {parseUserAgent(row.user_agent)}
                    {!row.success && <span className="ml-2 text-xs font-normal text-destructive">เข้าสู่ระบบไม่สำเร็จ</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.ip_address ?? 'ไม่ทราบ IP'} · {formatThaiDateTime(row.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="หน้าก่อนหน้า"
                className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-border disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="หน้าถัดไป"
                className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-border disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[800px] px-8 py-10">
      <h1 className="mb-6 text-[32px] font-bold text-primary">ตั้งค่าบัญชี</h1>
      <div className="flex flex-col gap-6">
        <PasswordSection />
        <LoginHistorySection />
      </div>
    </div>
  )
}
