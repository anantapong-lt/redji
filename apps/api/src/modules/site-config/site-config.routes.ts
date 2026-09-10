import { Elysia } from 'elysia'
import { loadPublicTopupConfig } from './site-config.controller'

export const siteConfigRoutes = new Elysia({ prefix: '/site-config' })
  .get('/topup', () => loadPublicTopupConfig())
