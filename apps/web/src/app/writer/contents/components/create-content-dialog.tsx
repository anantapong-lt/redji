'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Images, Plus, X } from 'lucide-react'

type ContentType = 'novel' | 'cartoon'

interface CreateContentDialogProps {
  defaultType: ContentType
}

const contentTypes = [
  {
    value: 'novel',
    label: 'นิยาย',
    description: 'เนื้อหาแบบข้อความแบ่งเป็นตอน',
    icon: BookOpen,
  },
  {
    value: 'cartoon',
    label: 'การ์ตูน',
    description: 'เนื้อหาแบบภาพแบ่งเป็นหน้า',
    icon: Images,
  },
] as const

export function CreateContentDialog({ defaultType }: CreateContentDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [contentType, setContentType] = useState<ContentType>(defaultType)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const params = new URLSearchParams({ type: contentType, title: trimmedTitle })
    router.push(`/writer/contents/create?${params.toString()}`)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTitle('')
          setContentType(defaultType)
          setIsOpen(true)
        }}
        className="cursor-pointer hover:text-white order-first flex min-h-12 self-end items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 lg:absolute lg:top-0 lg:right-0 lg:order-none"
      >
        <Plus className="size-4" strokeWidth={2} />
        สร้างเนื้อหาใหม่
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-content-dialog-title"
            className="w-full max-w-lg rounded-2xl border border-border bg-background p-5 shadow-2xl md:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="create-content-dialog-title" className="text-xl font-bold">
                  สร้างเนื้อหาใหม่
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  กรอกชื่อเรื่องและเลือกประเภทเนื้อหา
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="ปิดหน้าต่าง"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-5" strokeWidth={1.8} />
              </button>
            </div>

            <form className="mt-6" onSubmit={handleSubmit}>
              <label className="space-y-2">
                <span className="block text-sm font-semibold">
                  ชื่อเรื่อง <span className="text-destructive">*</span>
                </span>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={255}
                  required
                  autoFocus
                  placeholder="กรอกชื่อเรื่อง"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                />
              </label>

              <fieldset className="mt-5">
                <legend className="text-sm font-semibold">
                  ประเภทเนื้อหา <span className="text-destructive">*</span>
                </legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {contentTypes.map(({ value, label, description, icon: Icon }) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                        contentType === value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      <input
                        type="radio"
                        name="content-type"
                        value={value}
                        checked={contentType === value}
                        onChange={() => setContentType(value)}
                        className="sr-only"
                      />
                      <Icon className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.8} />
                      <span>
                        <span className="block text-sm font-bold">{label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground ">
                          {description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="min-h-11 rounded-xl border border-border px-5 text-sm font-semibold transition-colors hover:bg-accent"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={!title.trim()}
                  className="min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ดำเนินการต่อ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
