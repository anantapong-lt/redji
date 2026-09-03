'use client'

/**
 * components/works/age-gate.tsx — modal เตือนเนื้อหา 18+ (2026-07-30)
 *
 * โชว์เฉพาะตอน ageRate === '18+' และยังไม่เคยกดยืนยันในเบราว์เซอร์นี้มาก่อน (ดู
 * store/age-gate.store.ts) ปิดเองไม่ได้ (ไม่มีปุ่ม X, กด escape/คลิกนอกกรอบไม่ได้) ต้องกด
 * ปุ่มยืนยันเท่านั้นถึงจะเห็นเนื้อหาข้างหลัง — ใช้ทั้งหน้ารายละเอียดนิยายและหน้าอ่านตอน
 */

import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAgeGateStore } from '@/store/age-gate.store'

export function AgeGate({ ageRate }: { ageRate: 'all' | '18+' | undefined }) {
  const confirmed = useAgeGateStore((s) => s.confirmed)
  const confirm = useAgeGateStore((s) => s.confirm)

  const show = ageRate === '18+' && !confirmed

  return (
    <Dialog open={show} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-sm text-center"
      >
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <TriangleAlert className="size-6" />
          </div>
          <DialogTitle className="text-center">เนื้อหาต่อไปนี้เหมาะสำหรับผู้มีอายุ 18 ปีขึ้นไป</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          อาจมีเนื้อหาทางเพศ ความรุนแรง หรือภาษาที่ไม่เหมาะกับผู้เยาว์
        </p>

        <Button onClick={confirm} className="rounded-lg">
          เข้าใจแล้ว อายุ 18 ปีขึ้นไป
        </Button>
      </DialogContent>
    </Dialog>
  )
}
