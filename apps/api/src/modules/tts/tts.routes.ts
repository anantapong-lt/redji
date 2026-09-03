import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { requirePermission } from '../../lib/permission-guard'
import { accountRateLimitRule, enforceRateLimit } from '../../lib/rate-limit'
import {
  createAdminTtsRequest,
  createReaderTtsRequest,
  createWriterTtsRequest,
  cancelTtsRequest,
  getAutoReadPreferences,
  getTtsWorkerHealth,
  listTtsRequestsForAdmin,
  rejectTtsRequest,
  retryTtsRequest,
  startTtsRequest,
  updateAutoReadPreferences,
} from './tts.service'

export function handleTtsError(error: unknown, set: any) {
  const code = error instanceof Error ? error.message : ''
  const known: Record<string, { status: number; message: string }> = {
    WORK_NOT_FOUND: { status: 404, message: 'ไม่พบผลงานนี้' },
    EPISODE_NOT_FOUND: { status: 404, message: 'ไม่พบตอนนี้' },
    NOT_NOVEL: { status: 400, message: 'TTS ใช้ได้เฉพาะนิยาย' },
    TTS_NO_CONTENT: { status: 400, message: 'ไม่มีเนื้อหาสำหรับสร้างเสียง' },
    TTS_EPISODES_REQUIRED: { status: 400, message: 'กรุณาเลือกอย่างน้อยหนึ่งตอน' },
    INVALID_TTS_EPISODES: { status: 400, message: 'รายการตอนที่เลือกไม่ถูกต้อง' },
    TTS_REQUEST_NOT_FOUND: { status: 404, message: 'ไม่พบคำขอ TTS' },
    TTS_REQUEST_NOT_AWAITING_APPROVAL: { status: 400, message: 'คำขอนี้ไม่ได้อยู่ระหว่างรออนุมัติ' },
    TTS_EPISODE_BUSY: { status: 409, message: 'มีงานสร้างเสียงของตอนที่เลือกอยู่แล้ว' },
    TTS_NO_VOICE_SLOTS_SELECTED: { status: 400, message: 'กรุณาเลือกอย่างน้อยหนึ่งเสียง' },
    TTS_PRO_NOT_READY: { status: 409, message: 'TTS Pro ยังอยู่ระหว่างเชื่อม worker หลายเสียง จึงยังเริ่มสร้างเสียงจริงไม่ได้' },
    TTS_PRO_RENDER_DISABLED: { status: 409, message: 'ระบบ Pro พร้อมรับการตั้งค่าแล้ว แต่ยังล็อกการสร้างเสียงไว้จนกว่าจะตรวจไฟล์เสียงและเปิดใช้งาน' },
    TTS_PRO_VOICE_UNASSIGNED: { status: 400, message: 'มี Chunk ระบุตัวละคร แต่ช่องเสียงนั้นยังไม่ได้ตั้งหมวดเสียง Pro' },
  }
  const editorErrors: Record<string, { status: number; message: string }> = {
    TTS_EDITOR_SEARCH_REQUIRED: { status: 400, message: 'กรุณาพิมพ์ชื่อตอนหรือเลขตอนแล้วกด Enter' },
    TTS_EDITOR_INVALID_BLOCK_COUNT: { status: 400, message: 'จำนวน Chunk ไม่ถูกต้อง' },
    TTS_EDITOR_BLOCK_TOO_LONG: { status: 400, message: 'ข้อความใน Chunk ยาวเกินกำหนด' },
    TTS_EDITOR_INVALID_BLOCK_ID: { status: 400, message: 'รหัส Chunk ไม่ถูกต้อง' },
    TTS_EDITOR_DUPLICATE_BLOCK_ID: { status: 400, message: 'มีรหัส Chunk ซ้ำกัน' },
    TTS_EDITOR_INVALID_GAP: { status: 400, message: 'ระยะเวลาเว้นว่างต้องอยู่ระหว่าง 0.1–15 วินาที' },
    TTS_EDITOR_INVALID_COMMAND: { status: 400, message: 'คำสั่ง TTS ไม่ถูกต้อง' },
    TTS_EDITOR_RESERVED_COMMAND: { status: 400, message: '//1–//20 สงวนไว้สำหรับคำสั่งหลักของระบบ (คำสั่งนี้ยังไม่เปิดใช้)' },
    TTS_EDITOR_UNKNOWN_CHARACTER_SHORTCUT: { status: 400, message: 'ไม่พบคำสั่งลัดตัวละครนี้ในตารางตัวละคร' },
    TTS_EDITOR_MULTIPLE_CHARACTERS: { status: 400, message: 'หนึ่ง Chunk ระบุตัวละครได้หนึ่งคน' },
    TTS_EDITOR_TOO_MANY_CHARACTERS: { status: 400, message: 'ตั้งค่าตัวละครได้สูงสุด 6 ช่อง' },
    TTS_EDITOR_INVALID_CHARACTER: { status: 400, message: 'ข้อมูลตัวละครไม่ถูกต้อง' },
    TTS_EDITOR_DUPLICATE_CHARACTER: { status: 400, message: 'คำสั่งลัดหรือช่องตัวละครซ้ำกัน' },
    TTS_EDITOR_INVALID_VOICE_CATEGORY: { status: 400, message: 'รูปแบบหมวดเสียงไม่ถูกต้อง พิมพ์ได้แค่ ชื่อหมวด, ชื่อหมวด_เลข หรือ ชื่อหมวด_เลข! (เช่น handsome, handsome_3, handsome_3!)' },
    TTS_EDITOR_INVALID_SAVE_SLOT: { status: 400, message: 'ช่องบันทึกต้องเป็น 1 หรือ 2' },
    TTS_EDITOR_SAVE_TOO_LARGE: { status: 400, message: 'ไฟล์บันทึกมีขนาดใหญ่เกินกำหนด' },
  }
  // 2026-08-11 — 3 ข้อความนี้เป็นภาษาอังกฤษหลุดมาจากโค้ดชุด TTS เดิม (ต่างจากข้อความ error อื่นๆ
  // ในไฟล์นี้และทั้งระบบที่เป็นภาษาไทยหมด) แก้ให้ตรงกับที่อื่นทั้งระบบ
  const recoveryErrors: Record<string, { status: number; message: string }> = {
    INVALID_AUTO_READ_PREFERENCES: { status: 400, message: 'เปิด "อ่านต่ออัตโนมัติ" ก่อนถึงจะเปิด "ซื้ออัตโนมัติ" ได้' },
    TTS_REQUEST_NOT_CANCELLABLE: { status: 400, message: 'คำขอ TTS นี้ยกเลิกไม่ได้' },
    TTS_REQUEST_NOT_RETRYABLE: { status: 400, message: 'คำขอ TTS นี้ไม่มีงานที่ retry ได้' },
  }
  const matched = known[code] ?? editorErrors[code] ?? recoveryErrors[code]
  if (matched) {
    set.status = matched.status
    return { success: false, message: matched.message }
  }
  throw error
}

// Writer may request narration for selected episodes, but this route never
// creates a render job. Admin approval is the only path to the execution queue.
export const ttsWriterRoutes = new Elysia({ prefix: '/writer' })
  .use(authMiddleware)
  .onBeforeHandle(({ user, set }) => {
    if (user.level < 6) {
      set.status = 403
      return { success: false, message: 'ต้องเป็นนักเขียนหรือแอดมิน' }
    }
  })
  .post('/works/:uuid/tts-requests', async ({ user, params, body, set }) => {
    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('tts-writer-request', user.id, 5, 60 * 60),
    ])
    if (limited) return limited

    try {
      const result = await createWriterTtsRequest(BigInt(user.id), params.uuid, body.episode_ids, body.tier ?? 'basic')
      console.info('tts_writer_request', {
        outcome: result.created ? 'created' : 'reused_active_request',
        request_id: result.request.id,
        request_status: result.request.status,
        tier: result.request.tier,
        work_uuid: params.uuid,
        episode_count: body.episode_ids.length,
      })
      set.status = result.created ? 201 : 200
      return { success: true, data: result }
    } catch (error) {
      return handleTtsError(error, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({
      episode_ids: t.Array(t.String({ pattern: '^[0-9]+$' }), { minItems: 1 }),
      tier: t.Optional(t.Union([t.Literal('basic'), t.Literal('pro')])),
    }),
    detail: { summary: 'ส่งคำขอใช้ TTS ให้อนุมัติก่อนสร้างจริง', tags: ['TTS'] },
  })

// Reader requests from the current episode. The service intentionally expands
// the approval scope to the work's published episodes and hides reader identity
// from the Admin UI.
export const ttsReaderRoutes = new Elysia({ prefix: '/works' })
  .use(authMiddleware)
  .get('/:uuid/auto-read-preferences', async ({ user, params, set }) => {
    try {
      return { success: true, data: await getAutoReadPreferences(BigInt(user.id), params.uuid) }
    } catch (error) {
      return handleTtsError(error, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'Get account auto-read settings for a work', tags: ['TTS'] },
  })
  .put('/:uuid/auto-read-preferences', async ({ user, params, body, set }) => {
    try {
      const data = await updateAutoReadPreferences(BigInt(user.id), params.uuid, {
        autoNext: body.auto_next,
        autoPurchase: body.auto_purchase,
      })
      return { success: true, data }
    } catch (error) {
      return handleTtsError(error, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({ auto_next: t.Boolean(), auto_purchase: t.Boolean() }),
    detail: { summary: 'Save account auto-read settings for a work', tags: ['TTS'] },
  })
  .post('/:uuid/episodes/:ep_no/tts-requests', async ({ user, params, set }) => {
    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('tts-reader-request', user.id, 5, 60 * 60),
    ])
    if (limited) return limited

    try {
      const result = await createReaderTtsRequest(BigInt(user.id), params.uuid, Number(params.ep_no))
      set.status = result.created ? 201 : 200
      return { success: true, data: result }
    } catch (error) {
      return handleTtsError(error, set)
    }
  }, {
    params: t.Object({ uuid: t.String(), ep_no: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'ส่งคำขออ่านอัตโนมัติจากตอนที่กำลังอ่าน', tags: ['TTS'] },
  })

export const ttsAdminRoutes = new Elysia({ prefix: '/admin/tts' })
  .use(authMiddleware)
  .onBeforeHandle(async ({ user, set }) => {
    if (!(await requirePermission(user, 'tts.admin_panel.view', set))) {
      return { success: false, message: 'ต้องเป็นแอดมินรองขึ้นไป' }
    }
  })
  .get('/overview', async ({ query }) => {
    const [worker, requests] = await Promise.all([
      getTtsWorkerHealth(),
      listTtsRequestsForAdmin(query.tab ?? 'approval'),
    ])
    return { success: true, data: { worker, requests } }
  }, {
    query: t.Object({ tab: t.Optional(t.Union([t.Literal('approval'), t.Literal('queue'), t.Literal('history')])) }),
    detail: { summary: 'คำขอ TTS พร้อมสถานะ worker', tags: ['Admin TTS'] },
  })
  .post('/requests', async ({ user, body, set }) => {
    if (!(await requirePermission(user, 'tts.admin_request.manage', set))) {
      return { success: false, message: 'ไม่มีสิทธิ์สร้างคำขอ TTS เอง (ปรับได้ที่หน้าตั้งค่า)' }
    }
    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('tts-admin-create-request', user.id, 10, 60 * 60),
    ])
    if (limited) return limited

    try {
      const result = await createAdminTtsRequest(BigInt(user.id), body.work_uuid, body.episode_ids, body.tier ?? 'basic')
      set.status = result.created ? 201 : 200
      return { success: true, data: result }
    } catch (error) {
      return handleTtsError(error, set)
    }
  }, {
    body: t.Object({
      work_uuid: t.String(),
      episode_ids: t.Array(t.String({ pattern: '^[0-9]+$' }), { minItems: 1 }),
      tier: t.Optional(t.Union([t.Literal('basic'), t.Literal('pro')])),
    }),
    detail: { summary: 'สร้างคำขอ TTS จากฝั่งแอดมิน', tags: ['Admin TTS'] },
  })
  .post('/requests/:id/start', async ({ user, params, set }) => {
    if (!(await requirePermission(user, 'tts.admin_request.manage', set))) {
      return { success: false, message: 'ไม่มีสิทธิ์อนุมัติคำขอ TTS (ปรับได้ที่หน้าตั้งค่า)' }
    }
    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('tts-admin-control', user.id, 60, 60 * 60),
    ])
    if (limited) return limited

    try {
      return { success: true, data: await startTtsRequest(BigInt(user.id), BigInt(params.id)) }
    } catch (error) {
      return handleTtsError(error, set)
    }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'อนุมัติและย้ายคำขอ TTS เข้าคิวสร้างเสียง', tags: ['Admin TTS'] },
  })
  .post('/requests/:id/retry', async ({ user, params, set }) => {
    if (!(await requirePermission(user, 'tts.admin_request.manage', set))) {
      return { success: false, message: 'ไม่มีสิทธิ์ retry งาน TTS (ปรับได้ที่หน้าตั้งค่า)' }
    }
    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('tts-admin-control', user.id, 60, 60 * 60),
    ])
    if (limited) return limited

    try {
      return { success: true, data: await retryTtsRequest(BigInt(user.id), BigInt(params.id)) }
    } catch (error) {
      return handleTtsError(error, set)
    }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'Retry failed TTS jobs in a request', tags: ['Admin TTS'] },
  })
  .post('/requests/:id/cancel', async ({ user, params, set }) => {
    if (!(await requirePermission(user, 'tts.admin_request.manage', set))) {
      return { success: false, message: 'ไม่มีสิทธิ์ยกเลิกงาน TTS (ปรับได้ที่หน้าตั้งค่า)' }
    }
    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('tts-admin-control', user.id, 60, 60 * 60),
    ])
    if (limited) return limited

    try {
      return { success: true, data: await cancelTtsRequest(BigInt(user.id), BigInt(params.id)) }
    } catch (error) {
      return handleTtsError(error, set)
    }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'Cancel pending or processing TTS jobs in a request', tags: ['Admin TTS'] },
  })
  .post('/requests/:id/reject', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'tts.admin_request.manage', set))) {
      return { success: false, message: 'ไม่มีสิทธิ์ปฏิเสธคำขอ TTS (ปรับได้ที่หน้าตั้งค่า)' }
    }
    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('tts-admin-control', user.id, 60, 60 * 60),
    ])
    if (limited) return limited

    try {
      return { success: true, data: await rejectTtsRequest(BigInt(user.id), BigInt(params.id), body.reason) }
    } catch (error) {
      return handleTtsError(error, set)
    }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Object({ reason: t.Optional(t.String({ maxLength: 500 })) }),
    detail: { summary: 'ปฏิเสธคำขอ TTS', tags: ['Admin TTS'] },
  })
