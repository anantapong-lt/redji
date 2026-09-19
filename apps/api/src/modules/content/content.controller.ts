import {
  addPublicContentFavorite,
  addChapterComment,
  deleteChapterCommentById,
  getChapterCommentReactionSummary,
  getChapterCommentsForReading,
  findMangaChapterPages,
  findNovelChapterContent,
  findPublicChapterForReading,
  findPublicReaderChapters,
  findPublicChaptersBySlug,
  findPublicContentBySlug,
  listPublicContentForSitemap,
  ratePublicContentBySlug,
  removePublicContentFavorite,
  removeChapterCommentReactionById,
  setChapterCommentReactionById,
  updateChapterCommentById,
  incrementPublicContentView,
  type PublicChapterSort,
} from './content.service'
import { createWriterChapterPageSignedUrl } from '../writer/chapter/writer-chapter-page.service'
import { isFeatureEnabled } from '../site-config/site-config.service'

async function commentsAreEnabled() {
  return isFeatureEnabled('comments')
}

async function findCommentableChapter(
  slug: string,
  chapterNumber: string,
  currentUserId: string | null,
  requireReadAccess: boolean,
  hasAdminAccess = false,
) {
  const chapter = await findPublicChapterForReading(
    slug,
    Number(chapterNumber),
    currentUserId,
    hasAdminAccess,
  )
  if (!chapter) return null
  if (requireReadAccess && !chapter.can_read) return 'forbidden' as const
  return chapter
}

export async function getChapterComments(
  slug: string,
  chapterNumber: string,
  currentUserId: string | null,
  page = 1,
  limit = 10,
  hasAdminAccess = false,
) {
  try {
    if (!await commentsAreEnabled()) return Response.json({ message: 'ระบบความคิดเห็นปิดใช้งานอยู่' }, { status: 403 })
    const chapter = await findCommentableChapter(
      slug,
      chapterNumber,
      currentUserId,
      false,
      hasAdminAccess,
    )
    if (!chapter) return Response.json({ message: 'ไม่พบตอนที่ต้องการ' }, { status: 404 })
    if (chapter === 'forbidden') return Response.json({ message: 'คุณไม่มีสิทธิ์เข้าถึงความคิดเห็นของตอนนี้' }, { status: 403 })
    return getChapterCommentsForReading(chapter.id, currentUserId, page, limit)
  } catch (error) {
    console.error('Unable to load chapter comments', error)
    return Response.json({ message: 'ไม่สามารถโหลดความคิดเห็นได้' }, { status: 500 })
  }
}

export async function createChapterComment(
  slug: string,
  chapterNumber: string,
  currentUserId: string,
  body: string,
  parentCommentId?: string,
) {
  try {
    if (!await commentsAreEnabled()) return Response.json({ message: 'ระบบความคิดเห็นปิดใช้งานอยู่' }, { status: 403 })
    const chapter = await findCommentableChapter(slug, chapterNumber, currentUserId, true)
    if (!chapter) return Response.json({ message: 'ไม่พบตอนที่ต้องการ' }, { status: 404 })
    if (chapter === 'forbidden') return Response.json({ message: 'กรุณาซื้อตอนนี้ก่อนแสดงความคิดเห็น' }, { status: 403 })

    const comment = await addChapterComment(chapter.id, currentUserId, body, parentCommentId)
    if (!comment) return Response.json({ message: 'ไม่พบความคิดเห็นที่ต้องการตอบกลับ หรือข้อความว่างเปล่า' }, { status: 400 })
    return Response.json({ comment }, { status: 201 })
  } catch (error) {
    console.error('Unable to create chapter comment', error)
    return Response.json({ message: 'ไม่สามารถส่งความคิดเห็นได้' }, { status: 500 })
  }
}

export async function editChapterComment(
  slug: string,
  chapterNumber: string,
  commentId: string,
  currentUserId: string,
  body: string,
) {
  try {
    if (!await commentsAreEnabled()) return Response.json({ message: 'ระบบความคิดเห็นปิดใช้งานอยู่' }, { status: 403 })
    const chapter = await findCommentableChapter(slug, chapterNumber, currentUserId, true)
    if (!chapter) return Response.json({ message: 'ไม่พบตอนที่ต้องการ' }, { status: 404 })
    if (chapter === 'forbidden') return Response.json({ message: 'กรุณาซื้อตอนนี้ก่อนแก้ไขความคิดเห็น' }, { status: 403 })

    const comment = await updateChapterCommentById(chapter.id, commentId, currentUserId, body)
    if (!comment) return Response.json({ message: 'ไม่พบความคิดเห็นที่แก้ไขได้ หรือข้อความว่างเปล่า' }, { status: 404 })
    return { comment }
  } catch (error) {
    console.error('Unable to edit chapter comment', error)
    return Response.json({ message: 'ไม่สามารถแก้ไขความคิดเห็นได้' }, { status: 500 })
  }
}

export async function deleteChapterComment(
  slug: string,
  chapterNumber: string,
  commentId: string,
  currentUserId: string,
) {
  try {
    if (!await commentsAreEnabled()) return Response.json({ message: 'ระบบความคิดเห็นปิดใช้งานอยู่' }, { status: 403 })
    const chapter = await findCommentableChapter(slug, chapterNumber, currentUserId, true)
    if (!chapter) return Response.json({ message: 'ไม่พบตอนที่ต้องการ' }, { status: 404 })
    if (chapter === 'forbidden') return Response.json({ message: 'กรุณาซื้อตอนนี้ก่อนลบความคิดเห็น' }, { status: 403 })

    const deleted = await deleteChapterCommentById(chapter.id, commentId, currentUserId)
    if (!deleted) return Response.json({ message: 'ไม่พบความคิดเห็นที่ลบได้' }, { status: 404 })
    return { success: true }
  } catch (error) {
    console.error('Unable to delete chapter comment', error)
    return Response.json({ message: 'ไม่สามารถลบความคิดเห็นได้' }, { status: 500 })
  }
}

async function updateChapterCommentReaction(
  slug: string,
  chapterNumber: string,
  commentId: string,
  currentUserId: string,
  reaction: Parameters<typeof setChapterCommentReactionById>[3] | null,
) {
  if (!await commentsAreEnabled()) return Response.json({ message: 'ระบบความคิดเห็นปิดใช้งานอยู่' }, { status: 403 })
  const chapter = await findCommentableChapter(slug, chapterNumber, currentUserId, true)
  if (!chapter) return Response.json({ message: 'ไม่พบตอนที่ต้องการ' }, { status: 404 })
  if (chapter === 'forbidden') return Response.json({ message: 'กรุณาซื้อตอนนี้ก่อนกดรีแอ็กชัน' }, { status: 403 })

  const changed = reaction
    ? await setChapterCommentReactionById(chapter.id, commentId, currentUserId, reaction)
    : await removeChapterCommentReactionById(chapter.id, commentId, currentUserId)
  if (!changed && reaction) return Response.json({ message: 'ไม่พบความคิดเห็นที่ต้องการ' }, { status: 404 })

  const summary = await getChapterCommentReactionSummary(chapter.id, commentId, currentUserId)
  if (!summary) return Response.json({ message: 'ไม่พบความคิดเห็นที่ต้องการ' }, { status: 404 })
  return summary
}

export async function setChapterCommentReaction(
  slug: string,
  chapterNumber: string,
  commentId: string,
  currentUserId: string,
  reaction: Parameters<typeof setChapterCommentReactionById>[3],
) {
  try {
    return await updateChapterCommentReaction(slug, chapterNumber, commentId, currentUserId, reaction)
  } catch (error) {
    console.error('Unable to set chapter comment reaction', error)
    return Response.json({ message: 'ไม่สามารถบันทึกรีแอ็กชันได้' }, { status: 500 })
  }
}

export async function removeChapterCommentReaction(
  slug: string,
  chapterNumber: string,
  commentId: string,
  currentUserId: string,
) {
  try {
    return await updateChapterCommentReaction(slug, chapterNumber, commentId, currentUserId, null)
  } catch (error) {
    console.error('Unable to remove chapter comment reaction', error)
    return Response.json({ message: 'ไม่สามารถลบรีแอ็กชันได้' }, { status: 500 })
  }
}

export async function getPublicChapter(
  slug: string,
  chapterNumber: string,
  currentUserId: string | null,
  page = 1,
  limit = 5,
  hasAdminAccess = false,
) {
  try {
    const chapter = await findPublicChapterForReading(
      slug,
      Number(chapterNumber),
      currentUserId,
      hasAdminAccess,
    )
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
      findPublicReaderChapters(chapter.story.id, currentUserId, hasAdminAccess),
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

    if (page === 1 && !hasAdminAccess) await incrementPublicContentView(chapter.story.id)

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
  hasAdminAccess = false,
) {
  try {
    const chapter = await findPublicChapterForReading(
      slug,
      Number(chapterNumber),
      currentUserId,
      hasAdminAccess,
    )
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
  hasAdminAccess = false,
) {
  try {
    const result = await findPublicChaptersBySlug(
      slug,
      page ?? 1,
      limit ?? 25,
      currentUserId,
      sort ?? 'latest',
      hasAdminAccess,
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

export async function getPublicContent(
  slug: string,
  currentUserId: string | null = null,
  hasAdminAccess = false,
) {
  try {
    const story = await findPublicContentBySlug(slug, currentUserId, hasAdminAccess)

    if (!story) {
      return Response.json({ message: 'ไม่พบเรื่องที่ต้องการ' }, { status: 404 })
    }

    const chapters = await findPublicChaptersBySlug(
      slug,
      1,
      25,
      currentUserId,
      'latest',
      hasAdminAccess,
    )
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
