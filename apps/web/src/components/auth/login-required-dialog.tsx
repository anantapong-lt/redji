'use client'

import Link from 'next/link'
import { LogIn, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { loginUrlForCurrentPage } from '@/utils/login-redirect.util'

export function LoginRequiredDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-md" showCloseButton={false}>
        <DialogHeader className="items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </span>
          <DialogTitle className="text-lg font-extrabold">กรุณาเข้าสู่ระบบก่อน</DialogTitle>
          <DialogDescription className="leading-6">
            เข้าสู่ระบบเพื่อใช้งานฟีเจอร์นี้ คุณสามารถอยู่ในหน้านี้ต่อได้
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-6 -mb-6 px-6">
          <DialogClose asChild>
            <Button type="button" variant="outline">อยู่หน้านี้ต่อ</Button>
          </DialogClose>
          <Button asChild>
            <Link href={loginUrlForCurrentPage()}>
              <LogIn />เข้าสู่ระบบ
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
