'use client'

import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type IconInputProps = React.ComponentProps<typeof Input> & { icon?: React.ReactNode }

export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(function IconInput(
  { icon, className, ...props },
  ref,
) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
      )}
      <Input ref={ref} className={cn('h-12 rounded-xl', icon && 'pl-10', className)} {...props} />
    </div>
  )
})

export const PasswordInput = forwardRef<HTMLInputElement, IconInputProps>(function PasswordInput(
  { icon, className, ...props },
  ref,
) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
      )}
      <Input
        ref={ref}
        type={show ? 'text' : 'password'}
        className={cn('h-12 rounded-xl pr-10', icon && 'pl-10', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
})
