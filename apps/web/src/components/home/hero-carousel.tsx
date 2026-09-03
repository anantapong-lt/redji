'use client'

import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface HeroSlide {
  id: string
  title: string
  subtitle?: string
  image: string
  href: string
  /** วินาทีที่ค้างก่อนเลื่อนไปสไลด์ถัดไป — ตั้งได้ต่อรูปจากหน้าแอดมิน "ตั้งหน้าเว็บไซต์" */
  displaySeconds: number
}

// สีเฉลี่ยจากรูปปก ใช้ทำแสงออร่า — วาดรูปลง canvas เล็กๆ แล้วเฉลี่ย RGB ต้องเรียกตอนรูปโหลด
// เสร็จแล้วเท่านั้น รูปจาก R2 ผ่าน next/image optimizer จะกลาย same-origin (/_next/image?url=...)
// ก่อนถึงเบราว์เซอร์ เลยอ่าน pixel ด้วย canvas ได้โดยไม่โดน CORS taint แต่กัน error ไว้ด้วย try/catch
function getDominantColor(img: HTMLImageElement): string | null {
  try {
    const size = 16
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, size, size)
    const { data } = ctx.getImageData(0, 0, size, size)
    let r = 0
    let g = 0
    let b = 0
    let count = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      count++
    }
    if (count === 0) return null
    return `${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}`
  } catch {
    return null
  }
}

// สีเฉลี่ยดิบๆ จากรูป มักหม่น/ออกน้ำตาลเพราะปนทุกสีในรูปเข้าด้วยกัน — ดันความอิ่มตัว/ความสว่าง
// ขึ้นเป็น HSL ก่อน ให้ออกมาโทนสดเหมือนแสงไฟจริงๆ แทนที่จะเป็นสีหม่นๆ แบนๆ
function vividizeColor(rgbString: string): string {
  const [r, g, b] = rgbString.split(',').map((n) => Number(n.trim()) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  const d = max - min
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const vividS = Math.max(s, 0.7)
  const vividL = Math.min(Math.max(l, 0.5), 0.6)
  return `hsl(${Math.round(h)} ${Math.round(vividS * 100)}% ${Math.round(vividL * 100)}%)`
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'center' })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [colorCache, setColorCache] = useState<Record<string, string>>({})
  const [isPaused, setIsPaused] = useState(false)

  const handleImageLoad = useCallback((slideId: string, img: HTMLImageElement) => {
    const color = getDominantColor(img)
    if (!color) return
    setColorCache((prev) => (prev[slideId] === color ? prev : { ...prev, [slideId]: color }))
  }, [])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on('select', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi, onSelect])

  // เดินหน้าสไลด์เอง — ตั้งใจไม่ใช้ปลั๊กอิน embla-carousel-autoplay เพราะ delay ของมันคำนวณ
  // ครั้งเดียวตอน plugin init (จาก closure ของ slides ตอนนั้น) พอแอดมินแก้ display_seconds แล้ว
  // React Query refetch มาอัปเดต slides prop ใหม่ ตัวจับเวลาเดิมจะไม่รู้เรื่องด้วย ต้องรีเฟรชหน้า
  // เว็บทั้งหน้าถึงจะเห็นผล — ทำเองตรงนี้แทน อ่าน slides[selectedIndex].displaySeconds สดใหม่
  // ทุกครั้งที่ effect รัน เลยอัปเดตตามค่าล่าสุดได้จริงไม่ต้องรอรีเฟรชหน้า
  //
  // ใช้ signature (id+เวลาต่อสไลด์ ต่อกันเป็น string) แทนตัว slides array ตรงๆ ใน dependency —
  // page.tsx สร้าง heroSlides array ใหม่ทุกครั้งที่ re-render (เช่น react-query refetch ตอน
  // สลับกลับมาที่แท็บ) ทั้งที่เนื้อหาเหมือนเดิมทุกตัว ถ้าใช้ array ตรงๆ ตัวจับเวลาจะโดน reset
  // ทุกครั้งที่ re-render แม้ไม่มีอะไรเปลี่ยนจริง สไลด์จะไม่มีวันเลื่อนต่อเองสักที
  const slidesSignature = slides.map((s) => `${s.id}:${s.displaySeconds}`).join(',')
  useEffect(() => {
    if (!emblaApi || isPaused || slides.length <= 1) return
    const delayMs = (slides[selectedIndex]?.displaySeconds || 5) * 1000
    const timer = setTimeout(() => emblaApi.scrollNext(), delayMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emblaApi, selectedIndex, slidesSignature, isPaused])

  const activeSlide = slides[selectedIndex]
  const auraColor = activeSlide ? colorCache[activeSlide.id] : undefined
  const vividAura = auraColor ? vividizeColor(auraColor) : undefined

  return (
    <section
      className="relative w-full py-6 sm:py-8 md:py-10"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* พื้นหลัง — สีล้วนๆ (ไม่ใช่รูปเบลอ กันไม่ให้ดูออกว่าเป็นรูปซ้อน) เบลอจัดจนจางเป็นแสงกลืน
          ไม่มีรูปทรง กะกรอบให้ใกล้เคียงตัวการ์ด active จริง (% ซ้าย-ขวาอิงตาม flex-basis เดียวกับ
          การ์ด, บน-ล่างอิง padding ของ section) ตั้งใจไม่ให้ล้นออกไปไกลเกินขอบการ์ดที่โชว์อยู่ */}
      <div className="pointer-events-none absolute inset-x-[4.5%] inset-y-6 -z-10 sm:inset-y-8 md:inset-x-[7%] md:inset-y-10 lg:inset-x-[9%]">
        {vividAura && (
          <div
            className="h-full w-full rounded-[1.6rem] opacity-35 blur-2xl transition-[background-color,opacity] duration-700"
            style={{ backgroundColor: vividAura }}
          />
        )}
      </div>

      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((slide, i) => {
            const isActive = i === selectedIndex
            const media = (
              <>
                <Image
                  src={slide.image}
                  alt={slide.title}
                  fill
                  sizes="(min-width: 1024px) 82vw, (min-width: 768px) 86vw, 91vw"
                  priority={i === 0}
                  // สไลด์อื่นที่ไม่ใช่ตัวแรกต้อง eager ด้วย ไม่งั้นเจอ default lazy — ทุกสไลด์
                  // โผล่พีคอยู่ในจอแรกอยู่แล้ว (ไม่ได้ scroll ไปเจอทีหลัง) แต่ lazy รอ
                  // IntersectionObserver ทำให้รูปโชว์ช้า และดึงสีออร่าไม่ได้จนกว่าจะเลื่อนมาเจอ
                  loading={i === 0 ? undefined : 'eager'}
                  unoptimized={slide.image.startsWith('/')}
                  className="object-cover"
                  onLoad={(e) => handleImageLoad(slide.id, e.currentTarget)}
                  // รูปที่โหลดจาก cache เสร็จก่อน React ผูก onLoad ทัน จะไม่ยิง onLoad อีกเลย —
                  // เช็ค img.complete ตรงๆ ผ่าน ref กันไว้อีกทางด้วย
                  ref={(el) => {
                    if (el?.complete) handleImageLoad(slide.id, el)
                  }}
                />
                {slide.subtitle && isActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 px-6 text-center">
                    <div>
                      <h2 className="mb-2 text-xl font-bold text-white drop-shadow-md md:text-3xl">
                        {slide.title}
                      </h2>
                      <p className="text-sm text-white/90 drop-shadow md:text-base">
                        {slide.subtitle}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )

            return (
              <div key={slide.id} className="min-w-0 flex-[0_0_91%] px-1.5 md:flex-[0_0_86%] lg:flex-[0_0_82%] lg:px-3">
                {isActive ? (
                  <Link
                    href={slide.href}
                    className="relative block h-[170px] w-full overflow-hidden rounded-[1.6rem] border border-white/30 shadow-[0_24px_55px_-26px_rgb(45_29_32_/_0.62)] transition-[filter,opacity,transform] duration-300 hover:scale-[1.002] sm:h-[210px] md:h-[260px] lg:h-[300px] xl:h-[340px]"
                  >
                    {media}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => emblaApi?.scrollTo(i)}
                    aria-label={`ไปสไลด์ ${slide.title}`}
                    className="relative block h-[170px] w-full cursor-pointer overflow-hidden rounded-[1.6rem] border border-white/20 opacity-70 brightness-[0.45] transition-[filter,opacity,transform] duration-300 hover:opacity-85 sm:h-[210px] md:h-[260px] lg:h-[300px] xl:h-[340px]"
                  >
                    {media}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 rounded-full">
        {slides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => emblaApi?.scrollTo(i)}
            aria-label={`ไปสไลด์ที่ ${i + 1}`}
            className={cn(
              'h-2 cursor-pointer rounded-full transition-all',
              i === selectedIndex ? 'w-7 bg-primary shadow-sm' : 'w-2 bg-primary/25 hover:bg-primary/55',
            )}
          />
        ))}
      </div>
    </section>
  )
}
