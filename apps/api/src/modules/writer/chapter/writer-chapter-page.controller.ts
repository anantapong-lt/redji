import { status } from 'elysia'
import type { localChapterPageQuerySchema } from './writer-chapter-page.schema'
import { findLocalWriterChapterPage } from './writer-chapter-page.service'

export async function localChapterPageResponse(query: typeof localChapterPageQuerySchema.static) {
  try {
    const file = await findLocalWriterChapterPage(query.key, query.expires, query.signature)
    if (!file) return status(404, { message: 'Chapter page not found or URL expired' })

    return new Response(file, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Unable to read local chapter page', error)
    return status(500, { message: 'Unable to read chapter page' })
  }
}
