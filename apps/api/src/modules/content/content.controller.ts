import {
  findPublicChaptersBySlug,
  findPublicContentBySlug,
  listPublicContentForSitemap,
} from './content.service'

export async function getPublicContentChapters(
  slug: string,
  page = 1,
  limit = 25,
  currentUserId: string | null = null,
) {
  try {
    const result = await findPublicChaptersBySlug(slug, page, limit, currentUserId)

    if (!result) {
      return Response.json({ message: 'ไม่พบเรื่องที่ต้องการ' }, { status: 404 })
    }

    return result
  } catch (error) {
    console.error('Unable to load public content chapters', error)
    return Response.json(
      { message: 'ไม่สามารถโหลดรายการตอนได้ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 },
    )
  }
}

export async function getPublicContentSitemap() {
  try {
    return { contents: await listPublicContentForSitemap() }
  } catch (error) {
    console.error('Unable to load public content sitemap', error)
    return Response.json(
      { message: 'ไม่สามารถโหลดรายการเนื้อหาสำหรับ sitemap ได้' },
      { status: 500 },
    )
  }
}

export async function getPublicContent(slug: string) {
  try {
    const story = await findPublicContentBySlug(slug)

    if (!story) {
      return Response.json({ message: 'ไม่พบเรื่องที่ต้องการ' }, { status: 404 })
    }

    return { story }
  } catch (error) {
    console.error('Unable to load public content', error)
    return Response.json(
      { message: 'ไม่สามารถโหลดรายละเอียดเรื่องได้ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 },
    )
  }
}
