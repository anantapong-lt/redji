'use client'

import { useState } from 'react'
import { Check, Link2, Share2 } from 'lucide-react'
import { FaFacebookF, FaLine, FaWhatsapp, FaXTwitter } from 'react-icons/fa6'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ShareButtonsProps {
  title: string
  className?: string
  iconOnly?: boolean
}

const SHARE_PLATFORMS = [
  {
    label: 'Facebook',
    Icon: FaFacebookF,
    buttonClassName: 'border-[#1877F2]/25 hover:border-[#1877F2]/60 hover:bg-[#1877F2]/8 hover:text-[#1877F2]',
    markClassName: 'bg-[#1877F2] text-white',
    getUrl: (url: string, _title: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    label: 'X',
    Icon: FaXTwitter,
    buttonClassName: 'border-[#0F1419]/25 hover:border-[#0F1419]/60 hover:bg-[#0F1419]/8 hover:text-[#0F1419]',
    markClassName: 'bg-[#0F1419] text-white',
    getUrl: (url: string, title: string) =>
      `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    label: 'LINE',
    Icon: FaLine,
    buttonClassName: 'border-[#06C755]/30 hover:border-[#06C755]/70 hover:bg-[#06C755]/10 hover:text-[#049E44]',
    markClassName: 'bg-[#06C755] text-white',
    getUrl: (url: string, _title: string) =>
      `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`,
  },
  {
    label: 'WhatsApp',
    Icon: FaWhatsapp,
    buttonClassName: 'border-[#25D366]/30 hover:border-[#25D366]/70 hover:bg-[#25D366]/10 hover:text-[#128C4B]',
    markClassName: 'bg-[#25D366] text-[#073D20]',
    getUrl: (url: string, title: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  },
] as const

export function ShareButtons({ title, className, iconOnly = false }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  function shareTo(getUrl: (url: string, title: string) => string) {
    const shareUrl = getUrl(window.location.href, title)
    window.open(shareUrl, '_blank', 'noopener,noreferrer')
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={iconOnly ? 'แชร์ตอนนี้' : undefined}
          className={cn(
            iconOnly
              ? 'readji-icon-button flex size-9 cursor-pointer items-center justify-center'
              : 'flex h-9 w-fit cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-bold text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:bg-accent hover:text-primary hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/30',
            className,
          )}
        >
          <Share2 className={iconOnly ? 'size-5' : 'size-4'} aria-hidden="true" />
          {iconOnly ? null : 'แชร์เรื่องนี้'}
        </button>
      </DialogTrigger>

      <DialogContent className="gap-5 rounded-2xl p-5 sm:max-w-md sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">แชร์เรื่องนี้</DialogTitle>
          <DialogDescription className="line-clamp-2 pr-7">
            {title}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {SHARE_PLATFORMS.map((platform) => (
            <DialogClose key={platform.label} asChild>
              <button
                type="button"
                onClick={() => shareTo(platform.getUrl)}
                className={cn(
                  'group flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 text-left font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/30',
                  platform.buttonClassName,
                )}
              >
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold shadow-sm',
                    platform.markClassName,
                  )}
                >
                  <platform.Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="truncate text-sm">{platform.label}</span>
              </button>
            </DialogClose>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void copyLink()}
          aria-live="polite"
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold text-muted-foreground transition-colors hover:border-primary/45 hover:bg-accent hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          {copied ? (
            <Check className="size-4 text-primary" aria-hidden="true" />
          ) : (
            <Link2 className="size-4" aria-hidden="true" />
          )}
          {copied ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์'}
        </button>
      </DialogContent>
    </Dialog>
  )
}
