'use client'

import { CloudIcon, ImageIcon, LaptopIcon, LoaderCircleIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface FileUploadProgressDialogProps {
  open: boolean
  title?: string
  description?: string
  sourceLabel?: string
}

export function FileUploadProgressDialog({
  open,
  title = 'กำลังดำเนินการ',
  description = 'กรุณารอสักครู่...',
  sourceLabel = 'Client',
}: FileUploadProgressDialogProps) {
  return <Dialog open={open} onOpenChange={() => undefined}>
    <DialogContent
      className="text-center sm:max-w-md"
      showCloseButton={false}
      onEscapeKeyDown={(event) => event.preventDefault()}
      onPointerDownOutside={(event) => event.preventDefault()}
    >
      <DialogHeader className="items-center text-center">
        <style>{`
          @keyframes file-upload-progress-file {
            0% { opacity: 0; left: 10%; top: 62%; transform: rotate(-18deg) scale(.8); }
            15% { opacity: 1; left: 16%; top: 48%; transform: rotate(-10deg) scale(1); }
            30% { opacity: 1; left: 29%; top: 26%; transform: rotate(-2deg) scale(1); }
            45% { opacity: 1; left: 42%; top: 12%; transform: rotate(5deg) scale(1); }
            55% { opacity: 1; left: 54%; top: 8%; transform: rotate(8deg) scale(1); }
            65% { opacity: 1; left: 65%; top: 13%; transform: rotate(5deg) scale(.98); }
            72% { opacity: 1; left: calc(100% - 90px); top: 25%; transform: rotate(2deg) scale(.94); }
            75% { opacity: 1; left: calc(100% - 74px); top: 45%; transform: rotate(0deg) scale(.88); }
            88%, 100% { opacity: 0; left: calc(100% - 64px); top: 56%; transform: rotate(0deg) scale(.6); }
          }
          @keyframes file-upload-progress-cloud {
            0%, 100% { transform: scale(1); }
            55% { transform: scale(1.08); }
          }
        `}</style>
        <div aria-hidden className="relative mb-2 h-32 w-full overflow-hidden rounded-2xl bg-primary/10">
          <svg className="pointer-events-none absolute inset-0 size-full text-primary/35" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M 14 70 C 32 4, 66 4, 86 67" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" strokeLinecap="round" />
          </svg>
          <div className="absolute left-5 bottom-4 z-10 flex flex-col items-center gap-1 text-primary">
            <div className="grid size-12 place-items-center rounded-xl border border-primary/20 bg-background/80 shadow-sm backdrop-blur-sm">
              <LaptopIcon className="size-7 stroke-[1.75]" />
            </div>
            <span className="text-[10px] font-semibold tracking-wide">{sourceLabel}</span>
          </div>
          <div className="absolute right-5 bottom-4 size-16 rounded-full bg-primary/15 animate-ping" />
          <ImageIcon className="absolute z-20 size-9 rounded-lg bg-background p-1.5 text-primary shadow-sm" style={{ animation: 'file-upload-progress-file 1.8s linear infinite', willChange: 'left, top, transform, opacity' }} />
          <div className="absolute right-5 bottom-5 z-10" style={{ animation: 'file-upload-progress-cloud 1.8s ease-in-out infinite' }}>
            <div className="relative grid size-16 place-items-center rounded-full border border-primary/20 bg-background/80 text-primary shadow-lg shadow-primary/15 backdrop-blur-sm">
              <CloudIcon className="size-11 fill-primary/10 stroke-[1.5]" />
            </div>
          </div>
        </div>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="flex w-full items-center justify-center gap-2 text-center">
          <LoaderCircleIcon className="size-4 animate-spin" />
          {description}
        </DialogDescription>
      </DialogHeader>
    </DialogContent>
  </Dialog>
}
