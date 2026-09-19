'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { changePassword, setPassword } from '@/controllers/auth.controller'
import type { ChangePasswordInput, SetPasswordInput } from '@/interface/account-security.interface'
import { ApiError } from '@/lib/api-client'
import { PasswordStrengthIndicator } from '@/components/auth/password-strength-indicator'

const passwordSchema = z.object({
  current_password: z.string().min(1, 'กรุณากรอกรหัสผ่านเดิม').max(128),
  new_password: z.string().min(8, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร').max(72, 'รหัสผ่านต้องไม่เกิน 72 ตัวอักษร'),
  confirm_password: z.string().min(1, 'กรุณายืนยันรหัสผ่านใหม่').max(72),
}).refine((values) => values.new_password === values.confirm_password, {
  message: 'ยืนยันรหัสผ่านใหม่ไม่ตรงกัน', path: ['confirm_password'],
}).refine((values) => values.current_password !== values.new_password, {
  message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม', path: ['new_password'],
})

const passwordFields = [
  { name: 'current_password', label: 'รหัสผ่านเดิม', autoComplete: 'current-password', maxLength: 128 },
  { name: 'new_password', label: 'รหัสผ่านใหม่', autoComplete: 'new-password', maxLength: 72 },
  { name: 'confirm_password', label: 'ยืนยันรหัสผ่านใหม่', autoComplete: 'new-password', maxLength: 72 },
] as const

const setPasswordSchema = z.object({
  new_password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').max(72, 'รหัสผ่านต้องไม่เกิน 72 ตัวอักษร'),
  confirm_password: z.string().min(1, 'กรุณายืนยันรหัสผ่าน').max(72),
}).refine((values) => values.new_password === values.confirm_password, {
  message: 'ยืนยันรหัสผ่านไม่ตรงกัน', path: ['confirm_password'],
})

const setPasswordFields = [
  { name: 'new_password', label: 'รหัสผ่าน', autoComplete: 'new-password', maxLength: 72 },
  { name: 'confirm_password', label: 'ยืนยันรหัสผ่าน', autoComplete: 'new-password', maxLength: 72 },
] as const

function SetPasswordForm({ onPasswordSet }: { onPasswordSet: () => void }) {
  const { accessToken } = useAuth()
  const [visible, setVisible] = useState<Partial<Record<keyof SetPasswordInput, boolean>>>({})
  const { register, handleSubmit, setError, watch, formState: { errors, isSubmitting } } = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { new_password: '', confirm_password: '' },
  })
  const newPassword = watch('new_password')

  async function onSubmit(values: SetPasswordInput) {
    if (!accessToken) return
    try {
      const result = await setPassword(values, accessToken)
      toast.success(result.message, { duration: 2500 })
      onPasswordSet()
    } catch (error) {
      const field = error instanceof ApiError ? error.field : undefined
      const target = setPasswordFields.find((item) => item.name === field)?.name ?? 'root'
      setError(target, { message: error instanceof Error ? error.message : 'ไม่สามารถตั้งรหัสผ่านได้' }, { shouldFocus: true })
    }
  }

  return (
    <section aria-labelledby="set-password-heading" className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
      <h2 id="set-password-heading" className="flex items-center gap-2 text-lg font-bold"><LockKeyhole className="size-5 text-primary" />ตั้งรหัสผ่าน</h2>
      <p className="mt-1 text-sm text-muted-foreground">ตั้งรหัสผ่านสำหรับเข้าสู่ระบบด้วยอีเมล และเพื่อให้สามารถยกเลิกการเชื่อมต่อ Google ได้</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate aria-busy={isSubmitting} className="mt-5 space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
          {setPasswordFields.map(({ name, label, autoComplete, maxLength }) => (
            <div key={name} className="space-y-2">
              <Label htmlFor={`security-${name}`}>{label}</Label>
              <div className="relative">
                <Input id={`security-${name}`} type={visible[name] ? 'text' : 'password'} autoComplete={autoComplete}
                  maxLength={maxLength} disabled={isSubmitting} aria-invalid={Boolean(errors[name])}
                  aria-describedby={errors[name] ? `security-${name}-error` : undefined}
                  className="h-11 pr-11" {...register(name)} />
                <Button type="button" variant="ghost" size="icon" disabled={isSubmitting}
                  aria-label={`${visible[name] ? 'ซ่อน' : 'แสดง'}${label}`} aria-pressed={Boolean(visible[name])}
                  className="absolute top-1/2 right-1 size-9 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setVisible((current) => ({ ...current, [name]: !current[name] }))}>
                  {visible[name] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              {name === 'new_password' && <PasswordStrengthIndicator password={newPassword} />}
              {errors[name] && <p id={`security-${name}-error`} role="alert" className="text-xs text-destructive">{errors[name].message}</p>}
            </div>
          ))}
        </div>
        {errors.root?.message && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}
        <div className="flex justify-end"><Button type="submit" disabled={isSubmitting || !accessToken} className="w-full sm:w-auto"><LockKeyhole className="size-4" />{isSubmitting ? 'กำลังตั้งรหัสผ่าน...' : 'ตั้งรหัสผ่าน'}</Button></div>
      </form>
    </section>
  )
}

export function ChangePasswordSection({ hasPassword, onPasswordSet }: { hasPassword: boolean; onPasswordSet: () => void }) {
  const { accessToken } = useAuth()
  const [visible, setVisible] = useState<Partial<Record<keyof ChangePasswordInput, boolean>>>({})
  const { register, handleSubmit, reset, setError, watch, formState: { errors, isSubmitting } } = useForm<ChangePasswordInput>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  })
  const newPassword = watch('new_password')

  if (!hasPassword) return <SetPasswordForm onPasswordSet={onPasswordSet} />

  async function onSubmit(values: ChangePasswordInput) {
    if (!accessToken) return
    try {
      const result = await changePassword(values, accessToken)
      reset()
      setVisible({})
      toast.success(result.message, { duration: 2500 })
    } catch (error) {
      const field = error instanceof ApiError ? error.field : undefined
      const target = passwordFields.find((item) => item.name === field)?.name ?? 'root'
      setError(target, { message: error instanceof Error ? error.message : 'ไม่สามารถเปลี่ยนรหัสผ่านได้' }, { shouldFocus: true })
    }
  }

  return (
    <section aria-labelledby="change-password-heading" className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
      <h2 id="change-password-heading" className="flex items-center gap-2 text-lg font-bold"><LockKeyhole className="size-5 text-primary" />เปลี่ยนรหัสผ่าน</h2>
      <p className="mt-1 text-sm text-muted-foreground">รหัสผ่านใหม่ต้องมี 8–72 ตัวอักษร และไม่ซ้ำกับรหัสผ่านเดิม</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate aria-busy={isSubmitting} className="mt-5 space-y-5">
            <div className="grid gap-4 lg:grid-cols-3">
              {passwordFields.map(({ name, label, autoComplete, maxLength }) => (
                <div key={name} className="space-y-2">
                  <Label htmlFor={`security-${name}`}>{label}</Label>
                  <div className="relative">
                    <Input id={`security-${name}`} type={visible[name] ? 'text' : 'password'} autoComplete={autoComplete}
                      maxLength={maxLength} disabled={isSubmitting} aria-invalid={Boolean(errors[name])}
                      aria-describedby={errors[name] ? `security-${name}-error` : undefined}
                      className="h-11 pr-11" {...register(name)} />
                    <Button type="button" variant="ghost" size="icon" disabled={isSubmitting}
                      aria-label={`${visible[name] ? 'ซ่อน' : 'แสดง'}${label}`} aria-pressed={Boolean(visible[name])}
                      className="absolute top-1/2 right-1 size-9 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setVisible((current) => ({ ...current, [name]: !current[name] }))}>
                      {visible[name] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                  {name === 'new_password' && <PasswordStrengthIndicator password={newPassword} />}
                  {errors[name] && <p id={`security-${name}-error`} role="alert" className="text-xs text-destructive">{errors[name].message}</p>}
                </div>
              ))}
            </div>
            {errors.root?.message && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}
            <div className="flex justify-end"><Button type="submit" disabled={isSubmitting || !accessToken} className="w-full sm:w-auto"><LockKeyhole className="size-4" />{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}</Button></div>
      </form>
    </section>
  )
}
