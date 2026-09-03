'use client'

import { useEffect, useState } from 'react'
import { ChevronsDown, ChevronsUp } from 'lucide-react'

// ปุ่มลอยมุมขวาล่างเลื่อนขึ้นบนสุด/ลงล่างสุด — หน้าอ่านตอนยาวมาก (เนื้อหา+คอมเมนต์) เลื่อนเอง
// ด้วยนิ้ว/scrollbar ลำบาก โดยเฉพาะตอนอยากกลับขึ้นไปเช็คหัวข้อ/การ์ดตอนด้านบนแล้วเลื่อนกลับ
// ลงมาอ่านต่อ — ซ่อนปุ่มขึ้นตอนอยู่บนสุดแล้ว/ซ่อนปุ่มลงตอนอยู่ล่างสุดแล้ว กันโชว์ปุ่มที่กดไปแล้ว
// ไม่มีอะไรให้เลื่อนต่อ
export function ScrollNavButtons() {
  const [showUp, setShowUp] = useState(false)
  const [showDown, setShowDown] = useState(false)

  useEffect(() => {
    function handleScroll() {
      const scrollY = window.scrollY
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      setShowUp(scrollY > 400)
      setShowDown(maxScroll - scrollY > 400)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [])

  if (!showUp && !showDown) return null

  return (
    <div className="fixed right-4 bottom-6 z-30 flex flex-col gap-2 sm:right-6">
      {showUp && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="เลื่อนขึ้นบนสุด"
          className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-card text-foreground shadow-lg transition-transform hover:scale-105"
        >
          <ChevronsUp className="size-5" />
        </button>
      )}
      {showDown && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })}
          aria-label="เลื่อนลงล่างสุด"
          className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-card text-foreground shadow-lg transition-transform hover:scale-105"
        >
          <ChevronsDown className="size-5" />
        </button>
      )}
    </div>
  )
}
