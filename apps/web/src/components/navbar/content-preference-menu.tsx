'use client'

/**
 * components/navbar/content-preference-menu.tsx — เมนู "การแสดงผลเนื้อหา" (ไอคอนหัวใจ, 2026-08-17)
 *
 * อยู่ระหว่างกระดิ่งแจ้งเตือนกับช่องเติมเหรียญใน navbar ตามที่ user ระบุ — กดแล้วเปิด dropdown
 * มี 3 สวิช 3 จังหวะ (ซ่อน/ทั้งคู่/เฉพาะ) คุม 18+, BL, GL อิสระต่อกัน ผูกกับ
 * useContentPreferenceStore (localStorage, ข้ามหน้า/reload) — ตัวเลือกที่นี่ไปมีผลจริงที่หน้า Home
 * (page.tsx ranking board + home-section) กับหน้า /gallery?collection=popular (ดูจุด wiring ที่นั่น)
 *
 * ไอคอนหัวใจ (2026-08-17 รอบสอง — user ขอเป็น gradient) — คำนวณจุดไล่สีจากแกนที่ตั้งเป็น "เฉพาะ":
 *   - ไม่มีแกนไหน "เฉพาะ" เลย (รวมถึงตอน default ทั้งหมด "ทั้งคู่") → สีน้ำตาลล้วน (ทำด้วย gradient
 *     2 จุดสีเดียวกัน — trick เดียวกับให้ SVG linearGradient render เป็นสีทึบ)
 *   - แกนเดียว "เฉพาะ" → ไล่จากน้ำตาล (base) ไปสีของแกนนั้น (เช่น 18+ = ชมพู)
 *   - 2-3 แกน "เฉพาะ" พร้อมกัน → น้ำตาลหลุดออกจาก gradient ไปเลย ไล่สีระหว่างแกนที่เปิดเองแทน — ถ้า
 *     18+ เป็นหนึ่งในนั้น สีชมพูของ 18+ จะอยู่จุดเริ่ม (base) เสมอ (แทนที่บทบาทน้ำตาลเดิม) ตามที่ user
 *     ระบุ ("แทนที่สีน้ำตาลให้ชมพูเป็น Based แทน") ส่วนที่เหลือเรียงตามลำดับ 18+→BL→GL
 *
 * ใช้ SVG <linearGradient> + fill="url(#...)" ตรงๆ (ไม่ใช่ CSS mask แบบโลโก้ navbar เพราะ Heart
 * เป็น inline SVG จาก lucide-react อยู่แล้ว ใส่ fill เป็น gradient reference ได้เลยง่ายกว่า) —
 * useId() กัน id ชนกันเพราะ component นี้ render 2 รอบพร้อมกันเสมอ (desktop + mobile row)
 */

import { useId, useState } from 'react'
import { Heart } from 'lucide-react'
import { useContentPreferenceStore, type ContentPrefValue } from '@/store/content-preference.store'
import { cn } from '@/lib/utils'

const AXES: { key: 'age18' | 'bl' | 'gl'; label: string; activeBg: string; labelText: string; hex: string }[] = [
  { key: 'age18', label: '18+', activeBg: 'bg-pink-500', labelText: 'text-pink-700', hex: '#ec4899' },
  { key: 'bl', label: 'BL', activeBg: 'bg-sky-500', labelText: 'text-sky-700', hex: '#0ea5e9' },
  { key: 'gl', label: 'GL', activeBg: 'bg-purple-500', labelText: 'text-purple-700', hex: '#a855f7' },
]
const AXIS_HEX: Record<'age18' | 'bl' | 'gl', string> = Object.fromEntries(AXES.map((a) => [a.key, a.hex])) as any
const BROWN = '#54252b' // --primary เป๊ะ (ดู globals.css) — ตัวเดียวกับที่โลโก้ navbar ใช้

const POSITIONS: { value: ContentPrefValue; label: string }[] = [
  { value: 'hide', label: 'ซ่อน' },
  { value: 'both', label: 'ทั้งคู่' },
  { value: 'only', label: 'เฉพาะ' },
]

function PrefSlider({
  value,
  onChange,
  activeBg,
}: {
  value: ContentPrefValue
  onChange: (v: ContentPrefValue) => void
  activeBg: string
}) {
  const index = POSITIONS.findIndex((p) => p.value === value)
  return (
    <div className="relative flex h-8 flex-1 items-center rounded-full border border-border/60 bg-muted p-0.5">
      <div
        className={cn(
          'absolute inset-y-0.5 w-[calc(33.333%-0.083rem)] rounded-full shadow-sm transition-transform duration-200',
          activeBg,
        )}
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {POSITIONS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className={cn(
            'relative z-10 flex h-full flex-1 cursor-pointer items-center justify-center rounded-full text-[11px] font-semibold transition-colors',
            value === p.value ? 'text-white' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

// ---- คำนวณจุดไล่สีของหัวใจจากสถานะ 3 แกน — ดู comment หัวไฟล์สำหรับกฎเต็ม ----
function getHeartStops(pref: { age18: ContentPrefValue; bl: ContentPrefValue; gl: ContentPrefValue }): string[] {
  const onlyAxes = AXES.filter((a) => pref[a.key] === 'only').map((a) => a.key)

  if (onlyAxes.length === 0) return [BROWN, BROWN]
  if (onlyAxes.length === 1) return [BROWN, AXIS_HEX[onlyAxes[0]]]

  // 2-3 แกนพร้อมกัน — น้ำตาลหลุดออก, 18+ (ถ้ามี) เป็น base เสมอ ที่เหลือเรียงตามลำดับ AXES เดิม
  const ordered = onlyAxes.includes('age18')
    ? ['age18', ...onlyAxes.filter((k) => k !== 'age18')]
    : onlyAxes
  return ordered.map((k) => AXIS_HEX[k as 'age18' | 'bl' | 'gl'])
}

export function ContentPreferenceMenu() {
  const [open, setOpen] = useState(false)
  const gradientId = useId()
  const { age18, bl, gl, setAge18, setBl, setGl } = useContentPreferenceStore()

  const stops = getHeartStops({ age18, bl, gl })

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="readji-icon-button cursor-pointer"
        aria-label="การแสดงผลเนื้อหา"
      >
        {/* width/height=0 กันไม่ให้กิน layout — แค่ประกาศ gradient def ไว้ให้ Heart อ้างอิงผ่าน fill */}
        <svg width="0" height="0" className="absolute">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              {stops.map((color, i) => (
                <stop key={i} offset={`${(i / (stops.length - 1)) * 100}%`} stopColor={color} />
              ))}
            </linearGradient>
          </defs>
        </svg>
        <Heart className="size-5" fill={`url(#${gradientId})`} stroke={`url(#${gradientId})`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="readji-surface absolute right-0 top-full z-20 mt-3 w-72 overflow-hidden rounded-2xl p-4 shadow-[0_24px_54px_-28px_rgb(45_29_32_/_0.5)]">
            <p className="mb-1 text-sm font-semibold text-foreground">การแสดงผลเนื้อหา</p>
            <p className="mb-3 text-xs text-muted-foreground">
              ปรับได้อิสระทีละแนว — มีผลที่หน้าแรกและหน้านิยมตลอดกาล
            </p>

            <div className="flex flex-col gap-3">
              {AXES.map((axis) => (
                <div key={axis.key} className="flex items-center gap-2.5">
                  <span className={cn('w-8 shrink-0 text-sm font-bold', axis.labelText)}>{axis.label}</span>
                  <PrefSlider
                    value={axis.key === 'age18' ? age18 : axis.key === 'bl' ? bl : gl}
                    onChange={axis.key === 'age18' ? setAge18 : axis.key === 'bl' ? setBl : setGl}
                    activeBg={axis.activeBg}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
