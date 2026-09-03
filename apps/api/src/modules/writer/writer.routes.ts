import { Elysia, t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { STORY_STATUSES, STORY_TYPES } from '../../models/story.model'
import {
  createWriterContent,
  CreateWriterContentError,
  getMyContents,
  getWriterContent,
  updateWriterContent,
} from './writer-content.service'
import { getWriterStats } from './writer.service'

export const writerRoutes = new Elysia({ prefix: '/writer' })
  .use(authMiddleware)
  .get(
    '/stats',
    async ({ currentUser }) => ({ stats: await getWriterStats(currentUser.id) }),
    { auth: USER_ROLE.WRITER },
  )
  .get(
    '/contents',
    async ({ currentUser, query }) => getMyContents(currentUser.id, {
      tab: query.tab,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    }),
    {
      auth: USER_ROLE.WRITER,
      query: t.Object({
        tab: t.UnionEnum(['novel', 'cartoon']),
        page: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
      }),
    },
  )
  .post(
    '/contents',
    async ({ body, currentUser, status }) => {
      try {
        const story = await createWriterContent(currentUser.id, body)
        return status(201, { story })
      } catch (error) {
        if (error instanceof CreateWriterContentError) {
          return status(error.statusCode, {
            message: error.message,
            field: error.field,
          })
        }

        console.error('Unable to create writer content', error)
        return status(500, { message: 'ไม่สามารถสร้างเนื้อหาได้ กรุณาลองใหม่อีกครั้ง' })
      }
    },
    {
      auth: USER_ROLE.WRITER,
      body: t.Object({
        type: t.UnionEnum(STORY_TYPES),
        title: t.String({ minLength: 1, maxLength: 255 }),
        slug: t.String({ minLength: 1, maxLength: 255 }),
        synopsis: t.Optional(t.String({ maxLength: 140 })),
        status: t.UnionEnum(STORY_STATUSES),
        age_rating: t.Optional(t.String()),
        primary_genre_id: t.String({ format: 'uuid' }),
        secondary_genre_id: t.Optional(t.String()),
        cover: t.Optional(t.File({
          type: ['image/jpeg', 'image/png', 'image/webp'],
          maxSize: '5m',
        })),
      }),
    },
  )
  .get(
    '/contents/:id',
    async ({ currentUser, params, status }) => {
      try {
        return { story: await getWriterContent(currentUser.id, params.id) }
      } catch (error) {
        if (error instanceof CreateWriterContentError) {
          return status(error.statusCode, {
            message: error.message,
            field: error.field,
          })
        }

        console.error('Unable to load writer content', error)
        return status(500, { message: 'ไม่สามารถโหลดเนื้อหาได้ กรุณาลองใหม่อีกครั้ง' })
      }
    },
    {
      auth: USER_ROLE.WRITER,
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
    },
  )
  .patch(
    '/contents/:id',
    async ({ body, currentUser, params, status }) => {
      try {
        const story = await updateWriterContent(currentUser.id, params.id, body)
        return { story }
      } catch (error) {
        if (error instanceof CreateWriterContentError) {
          return status(error.statusCode, {
            message: error.message,
            field: error.field,
          })
        }

        console.error('Unable to update writer content', error)
        return status(500, { message: 'ไม่สามารถแก้ไขเนื้อหาได้ กรุณาลองใหม่อีกครั้ง' })
      }
    },
    {
      auth: USER_ROLE.WRITER,
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        type: t.UnionEnum(STORY_TYPES),
        title: t.String({ minLength: 1, maxLength: 255 }),
        slug: t.String({ minLength: 1, maxLength: 255 }),
        synopsis: t.Optional(t.String({ maxLength: 140 })),
        status: t.UnionEnum(STORY_STATUSES),
        age_rating: t.Optional(t.String()),
        primary_genre_id: t.String({ format: 'uuid' }),
        secondary_genre_id: t.Optional(t.String()),
        cover: t.Optional(t.File({
          type: ['image/jpeg', 'image/png', 'image/webp'],
          maxSize: '5m',
        })),
        remove_cover: t.Optional(t.Literal('true')),
      }),
    },
  )
