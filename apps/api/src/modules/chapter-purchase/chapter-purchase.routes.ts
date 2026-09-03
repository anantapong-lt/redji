import { Elysia, t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import {
  ChapterPurchaseError,
  purchaseChapter,
} from './chapter-purchase.service'

export const chapterPurchaseRoutes = new Elysia({ prefix: '/chapters' })
  .use(authMiddleware)
  .post(
    '/:chapterId/purchase',
    async ({ currentUser, params, status }) => {
      try {
        const purchase = await purchaseChapter(currentUser.id, params.chapterId)
        return status(201, { purchase })
      } catch (error) {
        if (error instanceof ChapterPurchaseError) {
          return status(error.statusCode, { message: error.message })
        }

        console.error('Unable to purchase chapter', error)
        return status(500, { message: 'ไม่สามารถซื้อตอนได้ กรุณาลองใหม่อีกครั้ง' })
      }
    },
    {
      auth: true,
      params: t.Object({
        chapterId: t.String({ format: 'uuid' }),
      }),
    },
  )
