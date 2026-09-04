import { Elysia } from 'elysia'
import { getLanding } from './landing.controller'
import { landingQuerySchema } from './landing.schema'

export const landingRoutes = new Elysia({ prefix: '/landing' }).get(
  '',
  ({ query }) => getLanding(query),
  { query: landingQuerySchema },
)
