import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { accountRateLimitRule, enforceRateLimit } from '../../lib/rate-limit'
import {
  deleteTtsEditorDraft,
  getTtsEditorEpisode,
  queueTtsEditorEpisode,
  saveTtsEditorDraft,
  saveTtsEditorEpisode,
  getTtsEditorWorkOverview,
  searchTtsEditorEpisodes,
} from './tts-editor.service'
import { handleTtsError } from './tts.routes'

const blockSchema = t.Object({
  id: t.Optional(t.String({ maxLength: 96 })),
  display_label: t.Optional(t.String({ maxLength: 120 })),
  text: t.String({ maxLength: 8000 }),
  style: t.Optional(t.Nullable(t.Any())),
  block_kind: t.Optional(t.Union([t.Literal('narration'), t.Literal('gap')])),
  gap_seconds: t.Optional(t.Number({ minimum: 0.1, maximum: 15 })),
  emotion: t.Optional(t.Union([t.Literal('neutral'), t.Literal('sad'), t.Literal('angry'), t.Literal('happy'), t.Literal('excited'), t.Literal('fear')])),
})

const voiceSlotSchema = t.Object({
  slot_no: t.Integer({ minimum: 0, maximum: 6 }),
  shortcuts: t.Array(t.String({ minLength: 1, maxLength: 33 }), { maxItems: 30 }),
  voice_category: t.Optional(t.String({ maxLength: 40 })),
})

export const ttsEditorWriterRoutes = new Elysia({ prefix: '/writer/tts-editor' })
  .use(authMiddleware)
  .onBeforeHandle(({ user, set }) => {
    if (user.level < 6) {
      set.status = 403
      return { success: false, message: 'ต้องเป็นนักเขียนก่อนจึงจะแก้ไขเสียงได้' }
    }
  })
  .get('/works/:uuid', async ({ user, params, set }) => {
    try {
      return { success: true, data: await getTtsEditorWorkOverview(BigInt(user.id), params.uuid) }
    } catch (error) {
      return handleTtsError(error, set)
    }
  }, { params: t.Object({ uuid: t.String({ minLength: 1, maxLength: 100 }) }) })
  .get('/works/:uuid/episodes', async ({ user, params, query, set }) => {
    try {
      return { success: true, data: await searchTtsEditorEpisodes(BigInt(user.id), params.uuid, query.query) }
    } catch (error) {
      return handleTtsError(error, set)
    }
  }, { params: t.Object({ uuid: t.String({ minLength: 1, maxLength: 100 }) }), query: t.Object({ query: t.String({ minLength: 1, maxLength: 100 }) }) })
  .get('/works/:uuid/episodes/:id', async ({ user, params, set }) => {
    try {
      return { success: true, data: await getTtsEditorEpisode(BigInt(user.id), params.uuid, BigInt(params.id)) }
    } catch (error) {
      return handleTtsError(error, set)
    }
  }, { params: t.Object({ uuid: t.String({ minLength: 1, maxLength: 100 }), id: t.String({ pattern: '^[0-9]+$' }) }) })
  .put('/works/:uuid/episodes/:id', async ({ user, params, body, set }) => {
    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('tts-editor-episode-save', user.id, 12, 10 * 60),
    ])
    if (limited) return limited

    try {
      return { success: true, data: await saveTtsEditorEpisode(BigInt(user.id), params.uuid, BigInt(params.id), body) }
    } catch (error) {
      return handleTtsError(error, set)
    }
  }, {
    params: t.Object({ uuid: t.String({ minLength: 1, maxLength: 100 }), id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Object({ blocks: t.Array(blockSchema, { minItems: 1, maxItems: 2000 }), labels: t.Optional(t.Array(voiceSlotSchema, { maxItems: 7 })) }),
  })
  .post('/works/:uuid/episodes/:id/queue', async ({ user, params, body, set }) => {
    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('tts-editor-queue', user.id, 10, 60 * 60),
    ])
    if (limited) return limited

    try {
      return { success: true, data: await queueTtsEditorEpisode(BigInt(user.id), params.uuid, BigInt(params.id), body?.voice_slots) }
    } catch (error) {
      return handleTtsError(error, set)
    }
  }, {
    params: t.Object({ uuid: t.String({ minLength: 1, maxLength: 100 }), id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Optional(t.Object({ voice_slots: t.Optional(t.Array(t.Union([t.Literal('old_male'), t.Literal('young_male'), t.Literal('female'), t.Literal('pro')])) ) })),
  })
  .put('/works/:uuid/episodes/:id/saves/:slot', async ({ user, params, body, set }) => {
    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('tts-editor-draft-save', user.id, 30, 10 * 60),
    ])
    if (limited) return limited

    try {
      return { success: true, data: await saveTtsEditorDraft(BigInt(user.id), params.uuid, BigInt(params.id), Number(params.slot), body.name, body.payload) }
    } catch (error) {
      return handleTtsError(error, set)
    }
  }, {
    params: t.Object({ uuid: t.String({ minLength: 1, maxLength: 100 }), id: t.String({ pattern: '^[0-9]+$' }), slot: t.String({ pattern: '^[12]$' }) }),
    body: t.Object({ name: t.String({ maxLength: 80 }), payload: t.Any() }),
  })
  .delete('/works/:uuid/episodes/:id/saves/:slot', async ({ user, params, set }) => {
    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('tts-editor-draft-save', user.id, 30, 10 * 60),
    ])
    if (limited) return limited

    try {
      await deleteTtsEditorDraft(BigInt(user.id), params.uuid, BigInt(params.id), Number(params.slot))
      return { success: true }
    } catch (error) {
      return handleTtsError(error, set)
    }
  }, { params: t.Object({ uuid: t.String({ minLength: 1, maxLength: 100 }), id: t.String({ pattern: '^[0-9]+$' }), slot: t.String({ pattern: '^[12]$' }) }) })
