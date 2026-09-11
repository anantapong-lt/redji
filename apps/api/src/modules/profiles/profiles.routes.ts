import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { getMyProfileResponse, getPublicProfileResponse, updateMyProfileCoverResponse, updateMyProfileResponse } from './profiles.controller'
import { profileStoriesQuerySchema, profileUsernameParamsSchema, updateMyProfileBodySchema, updateMyProfileCoverBodySchema } from './profiles.schema'

export const profilesRoutes = new Elysia({ prefix: '/profiles' })
  .use(authMiddleware)
  .get('/me', ({ currentUser }) => getMyProfileResponse(currentUser.id), { auth: true })
  .patch('/me', ({ currentUser, body }) => updateMyProfileResponse(currentUser.id, body), {
    auth: true,
    body: updateMyProfileBodySchema,
  })
  .post('/me/cover', ({ currentUser, body }) => updateMyProfileCoverResponse(currentUser.id, body.cover), {
    auth: true,
    body: updateMyProfileCoverBodySchema,
  })
  .get('/:username', ({ params, query }) => getPublicProfileResponse(params.username, query.type, query.page, query.limit), {
    params: profileUsernameParamsSchema,
    query: profileStoriesQuerySchema,
  })
