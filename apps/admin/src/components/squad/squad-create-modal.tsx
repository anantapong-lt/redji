'use client'

/**
 * components/squad/squad-create-modal.tsx — "เพิ่มบัญชี" (2026-08-12, ใหม่)
 *
 * เลือกระดับที่จะสร้าง — level 9 เลือกได้ 1 หรือ 8, level 10 เลือกได้ 1/8/9 (กว้างกว่า level 9 เสมอ)
 * level 1 = บัญชีเปล่าเตรียมเอาไว้ตั้งเป็นนักเขียนของเว็บ (level 7) ทีหลังผ่านหน้า "นักเขียน" ปกติ
 * ตั้งชื่อเอง (display_name) ได้ทุกระดับ เว้นว่างไว้ให้ระบบสุ่มให้ — username/รหัสผ่านสุ่มเสมอ ไม่ให้
 * ตั้งเองได้ทั้งคู่ (กันมีข้อมูลสืบหาตัวจริงได้ปนอยู่)
 *
 * รหัสผ่านสุ่มโดยระบบ โชว์ให้เห็น "ครั้งเดียว" ตอนสร้างเสร็จเท่านั้น — ปิดหน้าต่างแล้วดูซ้ำไม่ได้อีก
 * (เก็บแค่ argon2 hash เหมือนบัญชีทั่วไป ไม่มีทางถอดรหัสผ่านจริงกลับมาดูทีหลังได้เลย)
 */

import { useState } from 'react'
import { AlertTriangle, Check, Copy } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

interface CreatedCredentials {
  uuid: string
  u_name: string
  display_name: string
  level: number
  password: string
}

const LEVEL_OPTION_LABEL: Record<1 | 8 | 9, string> = {
  1: 'level 1 (เตรียมตั้งนักเขียนของเว็บทีหลัง)',
  8: 'level 8 (แอดมิน)',
  9: 'level 9 (แอดมิน)',
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg border border-input bg-muted px-3 py-2 text-sm">{value}</code>
        <Button
          type="button"
          variant="outline"
          onClick={handleCopy}
          aria-label={`ก็อป${label}`}
          className="h-10 w-10 shrink-0 px-0"
        >
          {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
    </div>
  )
}

export function SquadCreateModal({
  viewerLevel,
  onClose,
  onCreated,
}: {
  viewerLevel: number
  onClose: () => void
  onCreated: () => void
}) {
  const selectableLevels: (1 | 8 | 9)[] = viewerLevel >= 10 ? [1, 8, 9] : [1, 8]
  const [targetLevel, setTargetLevel] = useState<1 | 8 | 9>(1)
  const [customName, setCustomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreatedCredentials | null>(null)

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const data = await api
        .post<{ data: CreatedCredentials }>('/admin/squad/admins', {
          target_level: targetLevel,
          display_name: customName.trim() || undefined,
        })
        .then((res) => res.data)
      setResult(data)
      onCreated()
    } catch (err: any) {
      setError(err?.message ?? 'สร้างบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="เพิ่มบัญชี">
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>หน้าต่างนี้โชว์รหัสผ่านแค่ครั้งเดียว ปิดแล้วดูซ้ำไม่ได้อีกเลย ก็อปเก็บไว้ให้เรียบร้อยก่อนปิด — ทำหายทีหลังกดรีเซ็ตรหัสผ่านใหม่ได้จากหน้าลิสต์</span>
          </div>
          <CopyField label="Username" value={result.u_name} />
          <CopyField label="รหัสผ่าน" value={result.password} />
          <p className="text-xs text-muted-foreground">สร้างเป็นบัญชี level {result.level} ชื่อ &quot;{result.display_name}&quot; เรียบร้อยแล้ว</p>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              ปิด (เก็บข้อมูลแล้ว)
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            ห้ามทำข้อมูลบัญชีนี้หลุดออกไปนอกทีมงานเด็ดขาด
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">ระดับที่จะสร้าง</label>
            <div className="flex flex-col gap-2">
              {selectableLevels.map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setTargetLevel(lv)}
                  className={
                    targetLevel === lv
                      ? 'cursor-pointer rounded-lg bg-primary px-4 py-2 text-left text-sm font-medium text-primary-foreground'
                      : 'cursor-pointer rounded-lg border border-border px-4 py-2 text-left text-sm font-medium text-foreground hover:bg-muted'
                  }
                >
                  {LEVEL_OPTION_LABEL[lv]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">ตั้งชื่อเอง (ไม่บังคับ)</label>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              maxLength={50}
              placeholder="เว้นว่างไว้ให้ระบบสุ่มชื่อให้"
              className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <p className="mt-1 text-xs text-muted-foreground">ตั้งได้แค่ชื่อที่แสดง — username และรหัสผ่านสุ่มโดยระบบเสมอ ตั้งเองไม่ได้</p>
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={handleCreate} disabled={creating}>
              {creating ? 'กำลังสร้าง...' : `สร้างบัญชี level ${targetLevel}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
