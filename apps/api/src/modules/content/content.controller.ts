import {
  addPublicContentFavorite,
  findPublicChaptersBySlug,
  findPublicContentBySlug,
  listPublicContentForSitemap,
  ratePublicContentBySlug,
  removePublicContentFavorite,
  type PublicChapterSort,
} from './content.service'

export async function ratePublicContent(
  slug: string,
  currentUserId: string,
  rating: number,
) {
  try {
    const result = await ratePublicContentBySlug(slug, currentUserId, rating)
    if (!result) {
      return Response.json({ message: 'ไม่พบเรื่องที่ต้องการ' }, { status: 404 })
    }
    return result
  } catch (error) {
    console.error('Unable to rate public content', error)
    return Response.json({ message: 'ไม่สามารถบันทึกคะแนนได้' }, { status: 500 })
  }
}

export async function favoritePublicContent(slug: string, currentUserId: string) {
  try {
    const favorite = await addPublicContentFavorite(slug, currentUserId)
    if (!favorite) {
      return Response.json({ message: 'ไม่พบเรื่องที่ต้องการ' }, { status: 404 })
    }
    return favorite
  } catch (error) {
    console.error('Unable to favorite public content', error)
    return Response.json({ message: 'ไม่สามารถเพิ่มรายการโปรดได้' }, { status: 500 })
  }
}

export async function unfavoritePublicContent(slug: string, currentUserId: string) {
  try {
    const favorite = await removePublicContentFavorite(slug, currentUserId)
    if (!favorite) {
      return Response.json({ message: 'ไม่พบเรื่องที่ต้องการ' }, { status: 404 })
    }
    return favorite
  } catch (error) {
    console.error('Unable to unfavorite public content', error)
    return Response.json({ message: 'ไม่สามารถยกเลิกรายการโปรดได้' }, { status: 500 })
  }
}

export async function getPublicContentChapters(
  slug: string,
  page?: number,
  limit?: number,
  sort?: PublicChapterSort,
  currentUserId: string | null = null,
) {
  try {
    const result = await findPublicChaptersBySlug(
      slug,
      page ?? 1,
      limit ?? 25,
      currentUserId,
      sort ?? 'latest',
    )

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

export async function getPublicContent(slug: string, currentUserId: string | null = null) {
  try {
    const story = await findPublicContentBySlug(slug, currentUserId)

    if (!story) {
      return Response.json({ message: 'ไม่พบเรื่องที่ต้องการ' }, { status: 404 })
    }

    const chapters = await findPublicChaptersBySlug(slug, 1, 25, currentUserId)
    if (!chapters) {
      return Response.json({ message: 'ไม่พบเรื่องที่ต้องการ' }, { status: 404 })
    }

    return { story, chapters }
  } catch (error) {
    console.error('Unable to load public content', error)
    return Response.json(
      { message: 'ไม่สามารถโหลดรายละเอียดเรื่องได้ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 },
    )
  }
}
