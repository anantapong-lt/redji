'use client'

/**
 * components/transactions/redeem-code-form-dialog.tsx — สร้าง/แก้ไขโค้ด (2026-08-18, ใหม่)
 *
 * โหมดเดียวครอบทั้งสร้างและแก้ไข (code: null = สร้างใหม่) เหมือน category-dialog.tsx — code/type
 * แก้ไม่ได้หลังสร้าง (backend บังคับ) เพราะ redeem_code_uses เก็บ snapshot type/value ไว้แล้ว
 * เปลี่ยน "ความหมาย" ของโค้ดที่แจกไปแล้วจะสร้างความสับสน อยากเปลี่ยนให้สร้างใหม่แทน
 */

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import type { RedeemCodeAdminRow } from '@/types'

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function RedeemCodeFormDialog({
  code,
  open,
  onClose,
  onSaved,
}: {
  code: RedeemCodeAdminRow | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = code !== null

  const [codeText, setCodeText] = useState('')
  const [type, setType] = useState<'instant_coins' | 'topup_bonus_percent' | 'referral'>('instant_coins')
  const [value, setValue] = useState('')
  const [bonusWindowHours, setBonusWindowHours] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [maxUsesPerUser, setMaxUsesPerUser] = useState('1')
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [label, setLabel] = useState('')
  const [status, setStatus] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (code) {
      setCodeText(code.code)
      setType(code.type)
      setValue(code.value)
      setBonusWindowHours(code.bonus_window_hours ? String(code.bonus_window_hours) : '')
      setMaxUses(code.max_uses !== null ? String(code.max_uses) : '')
      setMaxUsesPerUser(String(code.max_uses_per_user))
      setValidFrom(toDatetimeLocal(code.valid_from))
      setValidUntil(toDatetimeLocal(code.valid_until))
      setLabel(code.label ?? '')
      setStatus(code.status === 'active')
    } else {
      setCodeText('')
      setType('instant_coins')
      setValue('')
      setBonusWindowHours('')
      setMaxUses('')
      setMaxUsesPerUser('1')
      setValidFrom('')
      setValidUntil('')
      setLabel('')
      setStatus(true)
    }
    setError(null)
  }, [open, code])

  async function handleSave() {
    setError(null)
    if (!isEdit && !codeText.trim()) {
      setError('กรุณาใส่โค้ด')
      return
    }
    const numValue = Number(value)
    if (!Number.isFinite(numValue) || numValue <= 0) {
      setError('กรุณาใส่มูลค่าที่มากกว่า 0')
      return
    }

    const body = {
      value: numValue,
      bonus_window_hours: type === 'topup_bonus_percent' && bonusWindowHours ? Number(bonusWindowHours) : null,
      max_uses: maxUses ? Number(maxUses) : null,
      max_uses_per_user: maxUsesPerUser ? Number(maxUsesPerUser) : 1,
      valid_from: validFrom ? new Date(validFrom).toISOString() : null,
      valid_until: validUntil ? new Date(validUntil).toISOString() : null,
      label: label.trim() || null,
    }

    setSaving(true)
    try {
      if (isEdit) {
        await api.patch(`/admin/redeem-codes/${code.id}`, { ...body, status: status ? 'active' : 'disabled' })
      } else {
        await api.post('/admin/redeem-codes', { ...body, code: codeText.trim(), type })
      }
      onClose()
      onSaved()
    } catch (err: any) {
      setError(err?.message ?? 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title={isEdit ? 'แก้ไขโค้ด' : 'สร้างโค้ดใหม่'}>
      <div className="flex flex-col gap-4">
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            โค้ด<span className="text-destructive">*</span>
          </label>
          <Input
            value={codeText}
            onChange={(e) => setCodeText(e.target.value.toUpperCase())}
            placeholder="เช่น WELCOME2026"
            maxLength={40}
            disabled={isEdit}
            className="font-mono uppercase"
          />
          {isEdit && <p className="mt-1 text-xs text-muted-foreground">แก้ไขตัวโค้ดไม่ได้ — สร้างโค้ดใหม่แทนถ้าต้องการเปลี่ยน</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">ประเภท</label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isEdit}
              onClick={() => setType('instant_coins')}
              className={
                type === 'instant_coins'
                  ? 'flex-1 cursor-pointer rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed'
                  : 'flex-1 cursor-pointer rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60'
              }
            >
              เติมเหรียญทันที
            </button>
            <button
              type="button"
              disabled={isEdit}
              onClick={() => setType('topup_bonus_percent')}
              className={
                type === 'topup_bonus_percent'
                  ? 'flex-1 cursor-pointer rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed'
                  : 'flex-1 cursor-pointer rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60'
              }
            >
              โบนัส % เติมเงินครั้งถัดไป
            </button>
            {/* referral สร้างใหม่ผ่านฟอร์มนี้ไม่ได้ (auto-gen ต่อ user คนละใบตอนเข้าหน้า "ชวนเพื่อน")
                โชว์ปุ่มนี้แค่ตอนแก้ไขโค้ด referral ที่มีอยู่แล้วเท่านั้น ให้เห็นว่าเป็นประเภทไหน */}
            {isEdit && type === 'referral' && (
              <button type="button" disabled className="flex-1 cursor-not-allowed rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                ชวนเพื่อน
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {type === 'instant_coins' ? 'จำนวนเหรียญ' : '% โบนัส/ค่าคอมมิชชั่น'}<span className="text-destructive">*</span>
          </label>
          <Input
            type="number"
            min="0.01"
            step={type === 'instant_coins' ? '1' : '0.01'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === 'instant_coins' ? 'เช่น 500' : 'เช่น 20 (=20%)'}
            className="w-40"
          />
          {type === 'referral' && (
            <p className="mt-1 text-xs text-muted-foreground">% ที่เจ้าของโค้ดได้จากยอดเติมเงินของเพื่อนที่ชวนมา ทุกครั้งที่เพื่อนเติม</p>
          )}
        </div>

        {type === 'topup_bonus_percent' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">เวลาที่มีสิทธิ์ใช้หลังแลกโค้ด (ชั่วโมง)</label>
            <Input
              type="number"
              min="1"
              value={bonusWindowHours}
              onChange={(e) => setBonusWindowHours(e.target.value)}
              placeholder="ค่าเริ่มต้น 72 ชม. (3 วัน)"
              className="w-48"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">จำนวนครั้งที่แลกได้รวม</label>
            <Input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="ไม่จำกัด" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">จำกัดต่อคน</label>
            <Input type="number" min="1" value={maxUsesPerUser} onChange={(e) => setMaxUsesPerUser(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">เริ่มใช้ได้ตั้งแต่</label>
            <Input type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">หมดอายุ</label>
            <Input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">โน้ต (ไม่แสดงต่อผู้ใช้)</label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="เช่น แคมเปญเปิดตัว ส.ค. 2026" maxLength={200} />
        </div>

        {isEdit && (
          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={status} onCheckedChange={setStatus} />
            <span className="text-sm text-foreground">เปิดใช้งาน (ปิด = แลกไม่ได้อีก แต่ประวัติเก่ายังอยู่)</span>
          </label>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            ยกเลิก
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
