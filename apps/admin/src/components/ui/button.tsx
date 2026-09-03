import * as React from 'react'
import { cn } from '@/lib/utils'

const VARIANT_CLASS = {
  default: 'bg-primary text-primary-foreground shadow-[0_10px_22px_-12px_rgb(84_37_43_/_0.8)] hover:-translate-y-px hover:bg-primary/92 hover:shadow-[0_14px_26px_-12px_rgb(84_37_43_/_0.65)]',
  outline: 'border border-border/90 bg-card/85 shadow-sm hover:-translate-y-px hover:border-primary/20 hover:bg-card hover:shadow-md',
  destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
  ghost: 'hover:bg-muted',
} as const

type Variant = keyof typeof VARIANT_CLASS

export function Button({
  className,
  variant = 'default',
  disabled,
  ...props
}: React.ComponentProps<'button'> & { variant?: Variant }) {
  return (
    <button
      disabled={disabled}
      className={cn(
        'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-transparent px-4 text-sm font-semibold whitespace-nowrap transition-all duration-200 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASS[variant],
        className,
      )}
      {...props}
    />
  )
}
