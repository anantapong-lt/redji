import { findPublicContentBySlug } from './content.service'

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
