'use client'

import { Minus, Plus, Type } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  type ReadingSettings,
  type ReadingTheme,
  READING_THEMES,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_STEP,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_STEP,
} from '@/lib/reading-settings'

const THEME_IDS = Object.keys(READING_THEMES) as ReadingTheme[]

function Stepper({
  label,
  value,
  displayValue,
  onDecrease,
  onIncrease,
  canDecrease,
  canIncrease,
}: {
  label: string
  value: number
  displayValue: string
  onDecrease: () => void
  onIncrease: () => void
  canDecrease: boolean
  canIncrease: boolean
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center justify-between rounded-[10px] border border-border p-1">
        <button
          type="button"
          onClick={onDecrease}
          disabled={!canDecrease}
          aria-label={`ลด${label}`}
          className="flex size-8 cursor-pointer items-center justify-center rounded-[10px] text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Minus className="size-4" />
        </button>
        <span className="text-sm font-medium text-foreground">{displayValue}</span>
        <button
          type="button"
          onClick={onIncrease}
          disabled={!canIncrease}
          aria-label={`เพิ่ม${label}`}
          className="flex size-8 cursor-pointer items-center justify-center rounded-[10px] text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}

export function ReadingSettingsPopover({
  settings,
  onChange,
}: {
  settings: ReadingSettings
  onChange: (settings: ReadingSettings) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="ตั้งค่าอ่าน"
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground sm:size-auto sm:flex-col sm:gap-1"
        >
          <Type className="size-5" />
          <span className="hidden text-xs sm:block">ตั้งค่าอ่าน</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-4 p-4">
        <Stepper
          label="ขนาดตัวอักษร"
          value={settings.fontSize}
          displayValue={`${settings.fontSize}px`}
          canDecrease={settings.fontSize > FONT_SIZE_MIN}
          canIncrease={settings.fontSize < FONT_SIZE_MAX}
          onDecrease={() => onChange({ ...settings, fontSize: Math.max(FONT_SIZE_MIN, settings.fontSize - FONT_SIZE_STEP) })}
          onIncrease={() => onChange({ ...settings, fontSize: Math.min(FONT_SIZE_MAX, settings.fontSize + FONT_SIZE_STEP) })}
        />

        <Stepper
          label="ระยะห่างบรรทัด"
          value={settings.lineHeight}
          displayValue={settings.lineHeight.toFixed(1)}
          canDecrease={settings.lineHeight > LINE_HEIGHT_MIN}
          canIncrease={settings.lineHeight < LINE_HEIGHT_MAX}
          onDecrease={() =>
            onChange({ ...settings, lineHeight: Math.round((Math.max(LINE_HEIGHT_MIN, settings.lineHeight - LINE_HEIGHT_STEP)) * 10) / 10 })
          }
          onIncrease={() =>
            onChange({ ...settings, lineHeight: Math.round((Math.min(LINE_HEIGHT_MAX, settings.lineHeight + LINE_HEIGHT_STEP)) * 10) / 10 })
          }
        />

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">ฟอนต์</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...settings, fontFamily: 'serif' })}
              className={cn(
                'flex-1 cursor-pointer rounded-[10px] border py-2 text-sm',
                settings.fontFamily === 'serif' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              มีหัว
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...settings, fontFamily: 'sans' })}
              className={cn(
                'flex-1 cursor-pointer rounded-[10px] border py-2 text-sm',
                settings.fontFamily === 'sans' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              ไม่มีหัว
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...settings, fontFamily: 'handwriting' })}
              className={cn(
                'flex-1 cursor-pointer rounded-[10px] border py-2 text-sm',
                settings.fontFamily === 'handwriting' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              ลายมือ
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">ธีมสี</p>
          <div className="flex gap-2">
            {THEME_IDS.map((themeId) => {
              const theme = READING_THEMES[themeId]
              return (
                <button
                  key={themeId}
                  type="button"
                  onClick={() => onChange({ ...settings, theme: themeId })}
                  aria-label={theme.label}
                  title={theme.label}
                  style={{ backgroundColor: theme.background ?? '#ffffff' }}
                  className={cn(
                    'size-9 cursor-pointer rounded-[10px] border-2 transition-colors',
                    settings.theme === themeId ? 'border-primary' : 'border-border',
                  )}
                />
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
