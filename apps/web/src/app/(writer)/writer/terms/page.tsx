'use client'

/**
 * app/(writer)/writer/terms/page.tsx — "ข้อกำหนดการใช้งาน" (2026-08-06, ใหม่)
 *
 * user ขอให้ทำไว้ก่อนแบบโล่งๆ (แค่โครงหน้า/แท็บในเมนู) ยังไม่ใส่เนื้อหาข้อกำหนดจริง — เป็นหน้า
 * static ล้วนๆ ไม่มี backend/DB รองรับเลย รอ user ให้เนื้อหาจริงมาใส่ทีหลัง
 */

import { ScrollText } from 'lucide-react'

export default function WriterTermsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ScrollText className="size-7" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">ข้อกำหนดการใช้งาน</h1>
      <p className="text-sm text-muted-foreground">
        ข้อกำหนดและเงื่อนไขสำหรับนักเขียนกำลังจะประกาศให้ทราบเร็วๆ นี้
      </p>
    </div>
  )
}
