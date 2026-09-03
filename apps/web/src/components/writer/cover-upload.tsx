'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Image from 'next/image'
import { Camera } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

export function CoverUpload({ onChange }: { onChange?: (file: File | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null)

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0]
      if (!file) return
      setPreview(URL.createObjectURL(file))
      onChange?.(file)
    },
    [onChange],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
    maxSize: MAX_SIZE,
    multiple: false,
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        'relative flex aspect-[2/3] w-full max-w-[300px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/40 text-center transition-colors hover:border-primary/40',
        isDragActive && 'border-primary bg-primary/5',
      )}
    >
      <input {...getInputProps()} />
      {preview ? (
        <Image src={preview} alt="ปกนิยาย" fill unoptimized className="object-cover" />
      ) : (
        <>
          <Camera className="size-8 text-muted-foreground" />
          <p className="px-6 text-xs text-muted-foreground">
            อัปโหลดภาพประกอบขนาดไม่เกิน 5 MB
            <br />
            (600 x 900)
            <br />
            ไฟล์นามสกุล .jpg และ .png
          </p>
        </>
      )}
    </div>
  )
}
