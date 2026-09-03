'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { LoaderCircle } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { createWriterContent } from '@/controllers/writer.controller'
import { ApiError } from '@/lib/api-client'
import { createStorySchema } from '../create-story.schema'

interface CreateStoryFormContextValue {
  errors: Record<string, string>
  clearFieldError: (name: string) => void
}

const CreateStoryFormContext = createContext<CreateStoryFormContextValue | null>(null)

interface CreateStoryFormProps {
  cancelHref: string
  children: ReactNode
}

export function CreateStoryForm({ cancelHref, children }: CreateStoryFormProps) {
  const { accessToken } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const clearFieldError = useCallback((name: string) => {
    setMessage(null)
    setErrors((currentErrors) => {
      if (!currentErrors[name]) return currentErrors

      const nextErrors = { ...currentErrors }
      delete nextErrors[name]
      return nextErrors
    })
  }, [])

  const contextValue = useMemo(() => ({ errors, clearFieldError }), [clearFieldError, errors])

  const scrollToFirstError = (form: HTMLFormElement, fieldName: string) => {
    window.requestAnimationFrame(() => {
      const field = form.querySelector<HTMLElement>(`[data-field="${fieldName}"]`)
      if (!field) return

      field.scrollIntoView({ behavior: 'smooth', block: 'center' })
      field.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, button')
        ?.focus({ preventScroll: true })
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting || isSaved) return

    const form = event.currentTarget
    const body = new FormData(form)
    const cover = body.get('cover')
    if (cover instanceof File && cover.size === 0) body.delete('cover')
    const validation = createStorySchema.safeParse(Object.fromEntries(body.entries()))

    if (!validation.success) {
      const nextErrors: Record<string, string> = {}
      for (const issue of validation.error.issues) {
        const fieldName = String(issue.path[0] ?? '')
        if (fieldName && !nextErrors[fieldName]) nextErrors[fieldName] = issue.message
      }

      setErrors(nextErrors)
      setMessage('กรุณาตรวจสอบข้อมูลที่กรอก')
      const firstFieldName = Object.keys(nextErrors)[0]
      if (firstFieldName) scrollToFirstError(form, firstFieldName)
      return
    }

    if (!accessToken) {
      setMessage('ไม่พบข้อมูลการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง')
      return
    }

    setIsSubmitting(true)
    setErrors({})
    setMessage(null)

    try {
      await createWriterContent(body, accessToken)
      setIsSaved(true)
      setMessage('บันทึกเนื้อหาเรียบร้อยแล้ว')
    } catch (error) {
      if (error instanceof ApiError && error.field) {
        setErrors({ [error.field]: error.message })
        setMessage('กรุณาตรวจสอบข้อมูลที่กรอก')
        scrollToFirstError(form, error.field)
        return
      }

      setMessage(error instanceof Error ? error.message : 'ไม่สามารถสร้างเนื้อหาได้')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(240px,1fr)] lg:items-start"
    >
      <CreateStoryFormContext.Provider value={contextValue}>
        {children}
      </CreateStoryFormContext.Provider>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5 lg:col-span-2">
        {message && (
          <p
            role="status"
            className={`mr-auto text-sm ${isSaved ? 'text-primary' : 'text-destructive'}`}
          >
            {message}
          </p>
        )}
        <Link
          href={cancelHref}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold transition-colors hover:bg-accent"
        >
          ยกเลิก
        </Link>
        <button
          type="submit"
          disabled={isSubmitting || isSaved}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting && <LoaderCircle className="size-4 animate-spin" strokeWidth={2} />}
          {isSubmitting ? 'กำลังบันทึก...' : isSaved ? 'บันทึกแล้ว' : 'บันทึกฉบับร่าง'}
        </button>
      </div>
    </form>
  )
}

export function useCreateStoryForm() {
  const context = useContext(CreateStoryFormContext)
  if (!context) throw new Error('useCreateStoryForm must be used inside CreateStoryForm')
  return context
}
