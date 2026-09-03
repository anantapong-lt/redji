import { Elysia, t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { uploadWriterCover } from './writer-cover.service'
import { getWriterStats } from './writer.service'

export const writerRoutes = new Elysia({ prefix: '/writer' })
  .use(authMiddleware)
  .get(
    '/stats',
    async ({ currentUser }) => ({ stats: await getWriterStats(currentUser.id) }),
    { auth: USER_ROLE.WRITER },
  )
  .post(
    '/contents/cover',
    async ({ body, status }) => {
      try {
        return await uploadWriterCover(body.file)
      } catch (error) {
        console.error('Unable to upload writer cover', error)
        return status(500, { message: 'ไม่สามารถอัปโหลดรูปปกได้ กรุณาลองใหม่อีกครั้ง' })
      }
    },
    {
      auth: USER_ROLE.WRITER,
      body: t.Object({
        file: t.File({
          type: ['image/jpeg', 'image/png', 'image/webp'],
          maxSize: '5m',
        }),
      }),
    },
  )
