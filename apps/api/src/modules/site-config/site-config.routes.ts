import { Elysia } from 'elysia'
import { loadPublicFeatureConfig, loadPublicTopupConfig } from './site-config.controller'

export const siteConfigRoutes = new Elysia({ prefix: '/site-config' })
  .get('/features', () => loadPublicFeatureConfig())
  .get('/topup', () => loadPublicTopupConfig())
