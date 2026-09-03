import type { Metadata } from 'next'
import { SITE_CONFIG } from '@/site.config'
import { WorkDetailClient } from './work-detail-client'

// ─── generateMetadata ต้องอยู่ใน Server Component เท่านั้น (ดู node_modules/next/dist/docs) —
// หน้านี้เดิมเป็น 'use client' ล้วนๆ ไม่มี metadata ต่อเรื่องเลย ทุกเรื่องโชว์ title/description
// เดียวกันหมด (ของ layout.tsx) ทั้งในผลค้นหาและ preview ตอนแชร์ลิงก์ (LINE/Facebook ไม่รัน JS เลย
// อ่านแค่ <head> ที่ server ส่งมาตรงๆ) — ย้าย logic เดิมทั้งหมดไป work-detail-client.tsx แล้ว fetch
// ข้อมูลซ้ำอีกรอบที่นี่เฉพาะสำหรับทำ metadata (Next.js dedupe fetch เดียวกันให้อัตโนมัติอยู่แล้ว)
export async function generateMetadata({
  params,
}: {
  params: Promise<{ uuid: string }>
}): Promise<Metadata> {
  const { uuid } = await params

  try {
    const res = await fetch(`${SITE_CONFIG.apiUrl}/works/${uuid}`)
    if (!res.ok) throw new Error('not found')
    const { data: work } = await res.json()

    const title = work.title as string
    const description = (work.description as string | null) ?? SITE_CONFIG.description
    const coverImage = work.cover_image as string | null

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
        images: coverImage ? [{ url: coverImage }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: coverImage ? [coverImage] : undefined,
      },
      alternates: {
        canonical: `/works/${uuid}`,
      },
    }
  } catch {
    // นิยายไม่มีจริง/ยังไม่เผยแพร่ — ใช้ metadata เริ่มต้นของ layout.tsx ไปเลย ไม่ throw
    // (WorkDetailClient จะเป็นคนโชว์ข้อความ "ไม่พบนิยายเรื่องนี้" เองอยู่แล้ว)
    return {}
  }
}

interface JsonLdWork {
  title: string
  description: string | null
  cover_image: string | null
  age_rate: 'all' | '18+' | null
  tags: string[]
  created_at: string
  updated_at: string
  author: { display_name: string } | null
  category_main: { name: string } | null
}

// ใช้ schema.org "Book" ทั้งสองประเภท (novel/manga) ตามที่ user ระบุใน site.config.ts — Google
// รองรับ Book เป็น type กว้างครอบคลุมสิ่งพิมพ์ทั่วไป ไม่มี type เฉพาะสำหรับการ์ตูน/มังงะที่ใช้กันแพร่
// หลายกว่านี้ ดึงข้อมูลซ้ำจาก fetch เดียวกันกับ generateMetadata (Next dedupe ให้อัตโนมัติ)
async function getJsonLdWork(uuid: string): Promise<JsonLdWork | null> {
  try {
    const res = await fetch(`${SITE_CONFIG.apiUrl}/works/${uuid}`)
    if (!res.ok) return null
    const { data } = await res.json()
    return data as JsonLdWork
  } catch {
    return null
  }
}

export default async function WorkDetailPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params
  const work = await getJsonLdWork(uuid)

  const jsonLd = work
    ? {
        '@context': 'https://schema.org',
        '@type': 'Book',
        name: work.title,
        description: work.description ?? undefined,
        image: work.cover_image ?? undefined,
        url: `${SITE_CONFIG.siteUrl}/works/${uuid}`,
        author: work.author ? { '@type': 'Person', name: work.author.display_name } : undefined,
        genre: [work.category_main?.name, ...work.tags].filter(Boolean),
        datePublished: work.created_at,
        dateModified: work.updated_at,
        isFamilyFriendly: work.age_rate !== '18+',
        inLanguage: 'th',
      }
    : null

  return (
    <>
      {jsonLd && (
        // eslint-disable-next-line react/no-danger -- JSON.stringify ของ object ที่เราสร้างเอง
        // ไม่ใช่ HTML ที่ inject จาก user input ตรงๆ ปลอดภัยเทียบเท่า pattern มาตรฐานของ Next.js
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <WorkDetailClient />
    </>
  )
}
