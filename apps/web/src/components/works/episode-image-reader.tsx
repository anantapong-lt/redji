'use client'

export interface EpisodeImage {
  image_path: string
  sort_order: number
}

// อ่านการ์ตูน (manga) แบบเลื่อนดูรูปยาวต่อกันเป็นแถบเดียว (webtoon-style) —
// ใช้ <img> ธรรมดาแทน next/image เพราะแต่ละหน้ามีสัดส่วนไม่เท่ากัน ไม่รู้ width/height ล่วงหน้า
export function EpisodeImageReader({ workTitle, images }: { workTitle: string; images: EpisodeImage[] }) {
  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="px-6 py-8 sm:px-16 sm:py-12">
      <p className="mb-8 text-center text-xs text-muted-foreground/60">เรื่อง: {workTitle}</p>

      <div className="mx-auto flex max-w-2xl select-none flex-col" onCopy={(e) => e.preventDefault()}>
        {sorted.map((img) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={img.sort_order}
            src={img.image_path}
            alt={`หน้า ${img.sort_order + 1}`}
            className="w-full"
            draggable={false}
          />
        ))}
      </div>
    </div>
  )
}
