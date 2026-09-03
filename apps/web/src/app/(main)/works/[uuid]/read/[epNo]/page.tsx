import type { Metadata } from 'next'
import { SITE_CONFIG } from '@/site.config'
import { EpisodeReaderClient } from './episode-reader-client'

// ─── generateMetadata ต้องอยู่ใน Server Component เท่านั้น — ดู page.tsx ของ
// /works/[uuid] สำหรับเหตุผลเต็ม (ย้าย client logic ไป episode-reader-client.tsx แล้ว)
//
// ⚠️ จงใจ fetch จาก GET /works/:uuid (public, ไม่เช็คสิทธิ์) แทนที่จะเรียก
// GET /works/:uuid/episodes/:epNo/read (endpoint จริงที่หน้านี้ใช้แสดงเนื้อหา) เพราะ endpoint
// หลังต้อง login/ซื้อก่อนถึงจะอ่านได้ — ถ้าเอามาทำ metadata บอท/guest ที่ไม่ได้ login จะได้
// error กลับมาแทนข้อมูล ทำให้ไม่มี title/description ให้โชว์เลย metadata เอาแค่ชื่อเรื่อง+คำโปรย
// ของนิยาย (ไม่ใช่เนื้อหาในตอน — เนื้อหาตอนเป็น paid content ไม่ควรโผล่ในผลค้นหาอยู่แล้ว)
export async function generateMetadata({
  params,
}: {
  params: Promise<{ uuid: string; epNo: string }>
}): Promise<Metadata> {
  const { uuid, epNo } = await params

  try {
    const res = await fetch(`${SITE_CONFIG.apiUrl}/works/${uuid}`)
    if (!res.ok) throw new Error('not found')
    const { data: work } = await res.json()

    const episode = (work.episodes as { ep_no: number; ep_name: string }[]).find(
      (ep) => ep.ep_no === Number(epNo),
    )
    const title = episode ? `${episode.ep_name} - ${work.title}` : (work.title as string)
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
        canonical: `/works/${uuid}/read/${epNo}`,
      },
      // ตอนที่ต้องซื้อ/ต้อง login อ่าน ไม่ควรให้ Google index หน้าเปล่าๆ ที่ guest เข้ามาแล้วเจอแต่
      // ข้อความ "ต้องซื้อก่อนอ่าน" — กันสับสนผู้ค้นหา (title/description ยังโชว์ปกติสำหรับ preview)
      robots: { index: false, follow: true },
    }
  } catch {
    return {}
  }
}

export default function EpisodeReaderPage() {
  return <EpisodeReaderClient />
}
