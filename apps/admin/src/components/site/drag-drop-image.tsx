'use client'

import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * components/site/drag-drop-image.tsx — โซนลาก-วางรูป (2026-08-04, ใหม่)
 * hand-rolled ด้วย native HTML5 drag events (ไม่พึ่ง react-dropzone แบบฝั่ง writer — apps/admin
 * ไม่มี dependency นี้ และ pattern ทั้งแอปเป็นแบบเขียนเองไม่พึ่ง lib หนักๆ อยู่แล้ว)
 */
export function DragDropImage({
  preview,
  onFileSelected,
  aspectClassName = 'aspect-[21/9]',
  // แนะนำ 1920×640 (3:1) ตรงกับอัตราส่วนจริงที่ desktop ใช้แสดง (hero-carousel.tsx: md:aspect-[3/1],
  // กว้างสุด 1274px) — มือถือแสดงที่ 21:9 (แคบกว่าเล็กน้อย) แต่ทั้งคู่ครอบด้วย object-cover อยู่แล้ว
  // เลยไม่ต้องตรงเป๊ะ แค่ให้กว้างพอไม่แตกตอนขยายจอใหญ่/จอ retina
  sizeHint = 'แนะนำ 1920×640px (อัตราส่วน 3:1)',
  // ต้องตรงกับ CAROUSEL_MAX_FILE_SIZE_MB ใน apps/api/src/modules/admin/admin.routes.ts เสมอ —
  // คนละโปรเจกต์ import ข้ามกันไม่ได้ แก้ตัวเลขฝั่งนั้นแล้วอย่าลืมมาแก้ default นี้ด้วย
  maxSizeMB = 15,
}: {
  preview: string | null
  onFileSelected: (file: File) => void
  aspectClassName?: string
  sizeHint?: string
  maxSizeMB?: number
}) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (file) onFileSelected(file)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'group relative flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors',
        aspectClassName,
        isDragging ? 'border-primary bg-primary/5' : 'border-input bg-muted',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {preview ? (
        <>
          <img src={preview} alt="ตัวอย่างรูป" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-medium text-transparent transition-colors group-hover:bg-black/50 group-hover:text-white">
            คลิกหรือลากรูปใหม่มาวางเพื่อเปลี่ยน
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <UploadCloud className="size-8" />
          <p className="text-sm">ลากรูปมาวาง หรือคลิกเพื่อเลือกไฟล์</p>
          <p className="text-xs">JPG, PNG, WebP — ไม่เกิน {maxSizeMB}MB</p>
          <p className="text-xs">{sizeHint}</p>
        </div>
      )}
    </div>
  )
}
