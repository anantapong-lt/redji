import {
  addPublicContentFavorite,
  findMangaChapterPages,
  findNovelChapterContent,
  findPublicChapterForReading,
  findPublicReaderChapters,
  findPublicChaptersBySlug,
  findPublicContentBySlug,
  listPublicContentForSitemap,
  ratePublicContentBySlug,
  removePublicContentFavorite,
  incrementPublicContentView,
  type PublicChapterSort,
} from './content.service'
import { createWriterChapterPageSignedUrl } from '../writer/chapter/writer-chapter-page.service'

export async function getPublicChapter(
  slug: string,
  chapterNumber: string,
  currentUserId: string | null,
  page = 1,
  limit = 5,
) {
  try {
    const chapter = await findPublicChapterForReading(slug, Number(chapterNumber), currentUserId)
    if (!chapter) {
      return Response.json({ message: 'ไม่พบตอนที่ต้องการ' }, { status: 404 })
    }

    if (!chapter.can_read) {
      return Response.json(
        { message: currentUserId ? 'กรุณาซื้อตอนนี้ก่อนอ่าน' : 'กรุณาเข้าสู่ระบบก่อนอ่านตอนนี้' },
        { status: currentUserId ? 403 : 401 },
      )
    }

    const [chapters, content, mangaPages] = await Promise.all([
      findPublicReaderChapters(chapter.story.id, currentUserId),
      chapter.story.type === 'novel'
        ? findNovelChapterContent(chapter.id)
        : Promise.resolve(null),
      chapter.story.type === 'manga'
        ? findMangaChapterPages(chapter.id, page, limit)
        : Promise.resolve({ pages: [], total: 0 }),
    ])

    const pages = mangaPages.pages.map(({ image_key, ...page }) => ({
      ...page,
      image_url: createWriterChapterPageSignedUrl(image_key),
    }))

    if (page === 1) await incrementPublicContentView(chapter.story.id)

    return Response.json(
      {
        story: chapter.story,
        chapter: {
          id: chapter.id,
          chapter_number: chapter.chapter_number,
          title: chapter.title,
          published_at: chapter.published_at,
        },
        chapters,
        content,
        pages,
        manga_page_pagination: {
          page,
          limit,
          total: mangaPages.total,
          has_next_page: page * limit < mangaPages.total,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('Unable to load public chapter', error)
    return Response.json(
      { message: 'ไม่สามารถโหลดเนื้อหาตอนได้ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 },
    )
  }
}

export async function getPublicMangaChapterPages(
  slug: string,
  chapterNumber: string,
  currentUserId: string | null,
  page = 1,
  limit = 5,
) {
  try {
    const chapter = await findPublicChapterForReading(slug, Number(chapterNumber), currentUserId)
    if (!chapter) return Response.json({ message: 'ไม่พบตอนที่ต้องการ' }, { status: 404 })

    if (!chapter.can_read) {
      return Response.json(
        { message: currentUserId ? 'กรุณาซื้อตอนนี้ก่อนอ่าน' : 'กรุณาเข้าสู่ระบบก่อนอ่านตอนนี้' },
        { status: currentUserId ? 403 : 401 },
      )
    }

    if (chapter.story.type !== 'manga') {
      return Response.json({ message: 'ไม่พบหน้ามังงะที่ต้องการ' }, { status: 404 })
    }

    const mangaPages = await findMangaChapterPages(chapter.id, page, limit)
    const pages = mangaPages.pages.map(({ image_key, ...mangaPage }) => ({
      ...mangaPage,
      image_url: createWriterChapterPageSignedUrl(image_key),
    }))

    return Response.json(
      {
        pages,
        pagination: {
          page,
          limit,
          total: mangaPages.total,
          has_next_page: page * limit < mangaPages.total,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('Unable to load public manga chapter pages', error)
    return Response.json({ message: 'ไม่สามารถโหลดภาพมังงะได้ กรุณาลองใหม่อีกครั้ง' }, { status: 500 })
  }
}

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
