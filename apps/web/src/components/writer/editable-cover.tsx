'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'

export function EditableCover({
  src,
  onChange,
}: {
  src: string | null
  onChange?: (file: File) => void
}) {
  const [preview, setPreview] = useState(src)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    onChange?.(file)
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="group relative aspect-[2/3] w-full max-w-[220px] cursor-pointer overflow-hidden rounded-xl bg-muted"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleFile}
      />
      {preview ? (
        <Image src={preview} alt="ปกนิยาย" fill unoptimized className="object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
          ไม่มีรูปปก
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-medium text-transparent transition-colors group-hover:bg-black/50 group-hover:text-white">
        เปลี่ยนรูปภาพ
      </div>
    </button>
  )
}
