import { Elysia } from 'elysia'
import { getPublicContent } from './content.controller'
import { contentParamsSchema } from './content.schema'

export const contentRoutes = new Elysia({ prefix: '/contents' }).get(
  '/:slug',
  ({ params }) => getPublicContent(params.slug),
  { params: contentParamsSchema },
)
