import type { MetadataRoute } from 'next'
import { SITE_CONFIG } from '@/site.config'

/**
 * app/sitemap.ts — 2026-08-18, ใหม่
 *
 * ดึงผลงานที่เผยแพร่แล้วทั้งหมดจาก GET /works (public, จำกัด 50 ต่อหน้าเหมือนหน้าเว็บ) วนอ่านทีละ
 * หน้าจนหมด — safety cap ที่ MAX_PAGES กัน sitemap เดียวเกิน 50,000 URL ของ Google (ตอนนี้มีไม่กี่สิบ
 * เรื่องเท่านั้น ยังห่างไกล — ถ้าวันไหนเกินจริงค่อยย้ายไป generateSitemaps() แบบแบ่งหลายไฟล์)
 *
 * ถ้า apps/api เรียกไม่ได้ตอน build (เช่น deploy ครั้งแรกที่ backend ยังไม่พร้อม) ปล่อยให้ sitemap
 * มีแค่ static routes ไปก่อน ดีกว่าทำทั้ง build พังเพราะหน้านี้หน้าเดียว
 */

const MAX_PAGES = 1000

interface ApiWork {
  uuid: string
  updated_at?: string
}

interface ApiWorksResponse {
  data: ApiWork[]
  pagination?: { total_pages: number }
}

async function fetchAllPublishedWorks(): Promise<ApiWork[]> {
  const all: ApiWork[] = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`${SITE_CONFIG.apiUrl}/works?page=${page}&limit=50`, {
      next: { revalidate: 3600 }, // 1 ชม. — sitemap ไม่ต้องสดเป๊ะวินาทีต่อวินาที
    })
    if (!res.ok) break

    const json: ApiWorksResponse = await res.json()
    if (json.data.length === 0) break

    all.push(...json.data)
    if (page >= (json.pagination?.total_pages ?? page)) break
  }

  return all
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_CONFIG.siteUrl

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/search`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/contact-admin`, changeFrequency: 'monthly', priority: 0.3 },
  ]

  let works: ApiWork[] = []
  try {
    works = await fetchAllPublishedWorks()
  } catch {
    // ปล่อยว่าง — ดีกว่า throw แล้วทำ sitemap ทั้งหน้าพัง
  }

  const workRoutes: MetadataRoute.Sitemap = works.map((w) => ({
    url: `${base}/works/${w.uuid}`,
    lastModified: w.updated_at ? new Date(w.updated_at) : undefined,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [...staticRoutes, ...workRoutes]
}
