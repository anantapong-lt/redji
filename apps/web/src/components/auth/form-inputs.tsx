'use client'

import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type IconInputProps = React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode }

export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(function IconInput(
  { icon, className = '', ...props },
  ref,
) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={`flex h-12 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm ${icon ? 'pl-10' : ''} ${className}`}
        {...props}
      />
    </div>
  )
})

export const PasswordInput = forwardRef<HTMLInputElement, IconInputProps>(function PasswordInput(
  { icon, className = '', ...props },
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
      <input
        ref={ref}
        {...props}
        type={show ? 'text' : 'password'}
        className={`flex h-12 w-full rounded-xl border border-input bg-transparent px-3 py-1 pr-10 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm ${icon ? 'pl-10' : ''} ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow((value) => !value)}
        aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
})
