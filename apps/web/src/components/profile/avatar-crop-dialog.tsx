'use client'

import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', () => reject(new Error('โหลดรูปไม่สำเร็จ')))
    img.src = src
  })
}

async function getCroppedBlob(imageSrc: string, area: CropArea): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = area.width
  canvas.height = area.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับ canvas')
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('ตัดรูปไม่สำเร็จ'))), 'image/jpeg', 0.92)
  })
}

// ครอบตัด/ซูมรูปโปรไฟล์ก่อนอัปโหลดจริง (เหมือน platform อื่นๆ เช่น Twitter/LinkedIn ที่ให้
// จัดวางตำแหน่ง+ซูมก่อนยืนยัน) — เดิมอัปโหลดไฟล์ดิบที่เลือกมาตรงๆ ไม่มีขั้นตอนนี้เลย
export function AvatarCropDialog({
  imageSrc,
  open,
  onOpenChange,
  onCropped,
}: {
  imageSrc: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCropped: (blob: Blob) => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null)
  const [busy, setBusy] = useState(false)

  const onCropComplete = useCallback((_croppedArea: unknown, areaPixels: CropArea) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  async function handleConfirm() {
    if (!imageSrc || !croppedAreaPixels) return
    setBusy(true)
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels)
      onCropped(blob)
      onOpenChange(false)
    } finally {
      setBusy(false)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>จัดวางรูปโปรไฟล์</DialogTitle>
        </DialogHeader>

        {imageSrc && (
          <div className="relative h-72 w-full overflow-hidden rounded-xl bg-muted">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
        )}

        <div className="flex items-center gap-3 px-1">
          <span className="shrink-0 text-xs text-muted-foreground">ซูม</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-primary"
          />
        </div>

        <div className="flex justify-center gap-3">
          <Button type="button" variant="destructive" onClick={() => onOpenChange(false)} disabled={busy} className="rounded-full px-6">
            ยกเลิก
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={busy || !croppedAreaPixels} className="rounded-full px-6">
            {busy ? 'กำลังตัด...' : 'ยืนยัน'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
