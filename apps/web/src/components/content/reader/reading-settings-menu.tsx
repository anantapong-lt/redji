'use client'

import { Minus, Plus, Type } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  READING_THEMES,
  type ReadingSettings,
  type ReadingTheme,
} from '@/lib/reading-settings'

const THEME_IDS = Object.keys(READING_THEMES) as ReadingTheme[]

export function ReadingSettingsMenu({
  settings,
  onChange,
}: {
  settings: ReadingSettings
  onChange: (settings: ReadingSettings) => void
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="ตั้งค่าการอ่าน"
          className="readji-icon-button flex size-9 cursor-pointer items-center justify-center"
        >
          <Type className="size-5" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 space-y-4 p-4">
        <SettingStepper
          label="ขนาดตัวอักษร"
          value={`${settings.fontSize}px`}
          decreaseDisabled={settings.fontSize <= 16}
          increaseDisabled={settings.fontSize >= 32}
          onDecrease={() => onChange({ ...settings, fontSize: Math.max(16, settings.fontSize - 2) })}
          onIncrease={() => onChange({ ...settings, fontSize: Math.min(32, settings.fontSize + 2) })}
        />
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">รูปแบบตัวอักษร</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['sans', 'ไม่มีหัว'],
              ['serif', 'มีหัว'],
            ] as const).map(([fontFamily, label]) => (
              <button
                key={fontFamily}
                type="button"
                onClick={() => onChange({ ...settings, fontFamily })}
                className={cn(
                  'cursor-pointer rounded-lg border px-3 py-2 text-sm font-semibold',
                  settings.fontFamily === fontFamily
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">ธีมสี</p>
          <div className="flex gap-2">
            {THEME_IDS.map((themeId) => {
              const theme = READING_THEMES[themeId]
              return (
                <button
                  key={themeId}
                  type="button"
                  aria-label={theme.label}
                  title={theme.label}
                  onClick={() => onChange({ ...settings, theme: themeId })}
                  style={{ backgroundColor: theme.background }}
                  className={cn(
                    'size-9 cursor-pointer rounded-lg border-2',
                    settings.theme === themeId ? 'border-primary' : 'border-border',
                  )}
                />
              )
            })}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SettingStepper({
  label,
  value,
  decreaseDisabled,
  increaseDisabled,
  onDecrease,
  onIncrease,
}: {
  label: string
  value: string
  decreaseDisabled: boolean
  increaseDisabled: boolean
  onDecrease: () => void
  onIncrease: () => void
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="flex items-center justify-between rounded-lg border border-border p-1">
        <button
          type="button"
          aria-label={`ลด${label}`}
          disabled={decreaseDisabled}
          onClick={onDecrease}
          className="flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <span className="text-sm font-bold tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`เพิ่ม${label}`}
          disabled={increaseDisabled}
          onClick={onIncrease}
          className="flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
