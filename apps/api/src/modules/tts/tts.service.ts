import { createHash } from 'node:crypto'
import type { Insertable, Transaction } from 'kysely'
import { db } from '../../db'
import type { DB, NovelBlock, NovelBlockTts } from '../../db/types'
import { writeAuditLog } from '../admin/admin.service'

export type TtsJobStatus = 'pending' | 'processing' | 'done' | 'failed' | 'cancelled'
export type TtsTier = 'basic' | 'pro'
export type TtsRequesterType = 'writer' | 'reader' | 'admin' | 'system_update' | 'writer_edit'
export type TtsRequestStatus = 'approval' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'rejected'
type TtsJobEventType = 'claimed' | 'lease_reclaimed' | 'retry_scheduled' | 'failed' | 'completed' | 'cancelled' | 'manual_retry' | 'manual_cancel' | 'cleanup_failed'
type TtsEventSeverity = 'info' | 'warning' | 'error'
export const TTS_BASIC_VOICE_SLOTS = [
  { id: 'old_male', label: 'ชายแก่' },
  { id: 'young_male', label: 'หนุ่มน้อย' },
  { id: 'female', label: 'คุณผู้หญิง' },
] as const
// Keep the old export as the Basic-only set. A surprising amount of UI and
// recovery code relies on this being exactly three variants.
export const TTS_VOICE_SLOTS = TTS_BASIC_VOICE_SLOTS
export const TTS_PRO_VOICE_SLOT = 'pro' as const
export type TtsBasicVoiceSlot = (typeof TTS_BASIC_VOICE_SLOTS)[number]['id']
export type TtsVoiceSlot = TtsBasicVoiceSlot | typeof TTS_PRO_VOICE_SLOT

export type TtsVoiceAssignment = {
  voice_category: string | null
  voice_index: number | null
  voice_shared: boolean
}
export type TtsVoiceAssignments = Record<string, TtsVoiceAssignment>

// This is a stable reader-facing release identifier.  The worker resolves the
// actual reference WAV from its local voice-slots.json, so a machine can change
// a source voice without changing the slot ID exposed to readers.
export const TTS_VOICE_PROFILE_VERSION = 'v1'

type DbExecutor = typeof db | Transaction<DB>

function isProRenderEnabled() {
  return process.env.TTS_PRO_RENDER_ENABLED === 'true' || process.env.TTS_PRO_RENDER_ENABLED === '1'
}

export async function getProVoiceAssignments(executor: DbExecutor, pId: bigint): Promise<TtsVoiceAssignments> {
  const labels = await executor
    .selectFrom('tts_work_character_labels')
    .select(['slot_no', 'voice_category', 'voice_index', 'voice_shared'])
    .where('p_id', '=', pId)
    .execute()
  const assignments: TtsVoiceAssignments = {}
  for (let slot = 0; slot <= 6; slot += 1) {
    const label = labels.find((item) => item.slot_no === slot)
    assignments[String(slot)] = {
      voice_category: label?.voice_category ?? null,
      voice_index: label?.voice_index ?? null,
      voice_shared: label?.voice_shared ?? false,
    }
  }
  return assignments
}

export function getProVoiceAssignmentHash(assignments: TtsVoiceAssignments) {
  return createHash('sha256').update(stableJson(assignments)).digest('hex')
}

function assertProBlocksHaveAssignedVoices(blocks: NovelBlock[], assignments: TtsVoiceAssignments) {
  for (const block of blocks) {
    const speakerSlot = block.tts?.speaker_slot
    if (speakerSlot === undefined) continue
    const assignment = assignments[String(speakerSlot)]
    if (!Number.isInteger(speakerSlot) || speakerSlot < 1 || speakerSlot > 6 || !assignment?.voice_category || !assignment.voice_index) {
      throw new Error('TTS_PRO_VOICE_UNASSIGNED')
    }
  }
}

async function recordTtsJobEvent(
  executor: DbExecutor,
  input: {
    jobId: bigint
    requestId: bigint | null
    type: TtsJobEventType
    severity?: TtsEventSeverity
    code?: string | null
    message: string
    context?: Record<string, unknown>
  },
) {
  await executor
    .insertInto('tts_job_events')
    .values({
      job_id: input.jobId,
      request_id: input.requestId,
      event_type: input.type,
      severity: input.severity ?? 'info',
      code: input.code ?? null,
      message: input.message.slice(0, 2000),
      context: input.context ?? {},
    })
    .execute()
}

// จงใจคง key เดิม (label, kind) ในข้อมูลที่เอาไปแฮชเสมอ แม้ type จริงจะเปลี่ยนไปใช้
// display_label/tts.block_kind แล้ว (rename 2026-08-16 ตาม Tier1_DesignCore.md) — เพราะ source_hash
// ของตอนที่มีเสียงอยู่แล้วถูกคำนวณไว้ด้วย key เดิม ถ้าเปลี่ยนชื่อ key ตรงนี้ตาม hash จะเปลี่ยนไปทั้ง
// ระบบทันที (ทั้งที่เนื้อหาจริงไม่เปลี่ยนเลย) getEpisodeAudioForBlocks() จะหาเสียงเดิมไม่เจอ ผู้อ่านเสีย
// เสียงที่มีอยู่แล้วทั้งหมด — ห้ามแก้ให้ตรงกับชื่อ field จริงเด็ดขาด อ่าน fallback จาก key เก่าด้วย
// เผื่อ blocks ที่ดึงมาจาก DB ตรงๆ ยังไม่ผ่าน normalizeStoredNovelBlock()
function canonicalBlocks(blocks: NovelBlock[]) {
  return blocks.map((block) => {
    const legacy = block as NovelBlock & { label?: string }
    const legacyTts = block.tts as (NovelBlockTts & { kind?: 'narration' | 'gap' }) | undefined
    return {
      id: block.id,
      label: block.display_label ?? legacy.label,
      text: block.text,
      style: block.style,
      tts_text: block.tts_text,
      tts: block.tts ? { ...block.tts, block_kind: undefined, kind: block.tts.block_kind ?? legacyTts?.kind } : block.tts,
    }
  })
}

function stableJson(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(String(value))
}

export function getTtsSourceHash(blocks: NovelBlock[]): string {
  return createHash('sha256').update(stableJson(canonicalBlocks(blocks))).digest('hex')
}

export function clearAudioTimestamps(blocks: NovelBlock[]): NovelBlock[] {
  return blocks.map((block) => ({ ...block, audio_ts: null }))
}

export function preserveAudioTimestamps(previousBlocks: NovelBlock[], nextBlocks: NovelBlock[]): NovelBlock[] {
  // A save may change writer/editor metadata without changing the spoken
  // source.  Timestamps are valid for that unchanged source hash, so retain
  // them by stable block ID instead of making working reader audio disappear.
  const timestampsByBlockId = new Map(previousBlocks.map((block) => [block.id, block.audio_ts]))
  return nextBlocks.map((block) => ({ ...block, audio_ts: timestampsByBlockId.get(block.id) ?? null }))
}

function serializeRequest(request: {
  id: bigint
  p_id: bigint
  requested_by: bigint | null
  requester_type: TtsRequesterType
  tier: TtsTier
  status: TtsRequestStatus
  source_episode_id: bigint | null
  auto_update: boolean
  priority: number
  requested_at: Date
  approved_at: Date | null
  queued_at: Date | null
  completed_at: Date | null
}) {
  return {
    id: String(request.id),
    p_id: String(request.p_id),
    requested_by: request.requested_by === null ? null : String(request.requested_by),
    requester_type: request.requester_type,
    tier: request.tier,
    status: request.status,
    source_episode_id: request.source_episode_id === null ? null : String(request.source_episode_id),
    auto_update: request.auto_update,
    priority: request.priority,
    requested_at: request.requested_at,
    approved_at: request.approved_at,
    queued_at: request.queued_at,
    completed_at: request.completed_at,
  }
}

async function getActiveNovelWork(workUuid: string) {
  const work = await db
    .selectFrom('works')
    .select(['p_id', 'uuid', 'title', 'author_id', 'type', 'status', 'view_count'])
    .where('uuid', '=', workUuid)
    .where('status', '=', 'active')
    .executeTakeFirst()
  if (!work) throw new Error('WORK_NOT_FOUND')
  if (work.type !== 'novel') throw new Error('NOT_NOVEL')
  return work
}

async function getRequestableEpisodes(pId: bigint, selectedIds?: bigint[], publishedOnly = false) {
  let query = db
    .selectFrom('work_ep')
    .select(['ep_id', 'ep_no', 'ep_name', 'ep_content', 'publish_status'])
    .where('p_id', '=', pId)
    .where('status', '=', 'active')
    .orderBy('ep_no', 'asc')

  if (selectedIds && selectedIds.length > 0) query = query.where('ep_id', 'in', selectedIds)
  if (publishedOnly) query = query.where('publish_status', 'in', ['now', 'schedule'])

  const episodes = await query.execute()
  if (selectedIds && episodes.length !== selectedIds.length) throw new Error('INVALID_TTS_EPISODES')
  const usable = episodes.filter((episode) => episode.ep_content?.some((block) => block.text.trim().length > 0))
  if (usable.length === 0) throw new Error('TTS_NO_CONTENT')
  return usable
}

function parseEpisodeIds(ids: string[]): bigint[] {
  const unique = [...new Set(ids)]
  if (unique.length === 0) throw new Error('TTS_EPISODES_REQUIRED')
  if (unique.some((id) => !/^\d+$/.test(id))) throw new Error('INVALID_TTS_EPISODES')
  return unique.map((id) => BigInt(id))
}

async function findActiveRequest(pId: bigint) {
  return db
    .selectFrom('tts_requests')
    .selectAll()
    .where('p_id', '=', pId)
    .where('status', 'in', ['approval', 'queued', 'processing'])
    .orderBy('requested_at', 'asc')
    .executeTakeFirst()
}

async function createRequest(input: {
  pId: bigint
  requestedBy: bigint | null
  requesterType: Exclude<TtsRequesterType, 'system_update' | 'writer_edit'>
  tier: TtsTier
  sourceEpisodeId?: bigint
  episodeIds: bigint[]
}) {
  const active = await findActiveRequest(input.pId)
  if (active) return { created: false, request: serializeRequest(active) }

  return db.transaction().execute(async (trx) => {
    const request = await trx
      .insertInto('tts_requests')
      .values({
        p_id: input.pId,
        requested_by: input.requestedBy,
        requester_type: input.requesterType,
        tier: input.tier,
        status: 'approval',
        source_episode_id: input.sourceEpisodeId ?? null,
        auto_update: false,
        priority: 0,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    await trx
      .insertInto('tts_request_episodes')
      .values(input.episodeIds.map((epId) => ({ request_id: request.id, ep_id: epId })))
      .execute()

    return { created: true, request: serializeRequest(request) }
  })
}

export async function createWriterTtsRequest(userId: bigint, workUuid: string, episodeIds: string[], tier: TtsTier = 'basic') {
  const work = await getActiveNovelWork(workUuid)
  // node-postgres คืน BIGINT เป็น string ตอน runtime แม้ type ของ Kysely จะเป็น bigint;
  // ห้ามเทียบ "88" กับ 88n โดยตรง เพราะจะตัดสิทธิ์เจ้าของผลงานจริงทุกคน
  if (String(work.author_id) !== userId.toString()) throw new Error('WORK_NOT_FOUND')
  const selected = await getRequestableEpisodes(work.p_id, parseEpisodeIds(episodeIds))
  return createRequest({
    pId: work.p_id,
    requestedBy: userId,
    requesterType: 'writer',
    tier,
    episodeIds: selected.map((episode) => episode.ep_id),
  })
}

export async function createReaderTtsRequest(userId: bigint, workUuid: string, epNo: number) {
  const current = await db
    .selectFrom('work_ep as ep')
    .innerJoin('works as work', 'work.p_id', 'ep.p_id')
    .select(['ep.ep_id', 'ep.p_id', 'ep.ep_content', 'work.uuid', 'work.type', 'work.status'])
    .where('work.uuid', '=', workUuid)
    .where('ep.ep_no', '=', epNo)
    .where('ep.status', '=', 'active')
    .where('ep.publish_status', 'in', ['now', 'schedule'])
    .where('work.status', '=', 'active')
    .executeTakeFirst()
  if (!current || current.type !== 'novel') throw new Error('EPISODE_NOT_FOUND')
  if (!current.ep_content?.some((block) => block.text.trim().length > 0)) throw new Error('TTS_NO_CONTENT')

  const access = await db.selectFrom('tts_work_access').selectAll().where('p_id', '=', current.p_id).executeTakeFirst()
  if (access) {
    const queued = await enqueueAutoTtsForEpisode(current.ep_id)
    return { created: false, queued: queued !== null, request: queued ? serializeRequest(queued) : null }
  }

  // A reader asks from the current episode, but the approval scope is the work's
  // published novel episodes so Admin can approve one coherent narration plan.
  const episodes = await getRequestableEpisodes(current.p_id, undefined, true)
  const result = await createRequest({
    pId: current.p_id,
    requestedBy: userId,
    requesterType: 'reader',
    tier: 'basic',
    sourceEpisodeId: current.ep_id,
    episodeIds: episodes.map((episode) => episode.ep_id),
  })
  return { ...result, queued: false }
}

// These settings are deliberately stored per work and account. The browser
// may remember a playback position locally, but permission to advance and
// spend coins must survive device changes and be visible to the API.
export async function getAutoReadPreferences(userId: bigint, workUuid: string) {
  const work = await getActiveNovelWork(workUuid)
  const preference = await db
    .selectFrom('user_work_auto_read_preferences')
    .select(['auto_next', 'auto_purchase', 'updated_at'])
    .where('user_id', '=', userId)
    .where('p_id', '=', work.p_id)
    .executeTakeFirst()
  return {
    auto_next: preference?.auto_next ?? false,
    auto_purchase: preference?.auto_purchase ?? false,
    updated_at: preference?.updated_at ?? null,
  }
}

export async function updateAutoReadPreferences(
  userId: bigint,
  workUuid: string,
  preference: { autoNext: boolean; autoPurchase: boolean },
) {
  if (preference.autoPurchase && !preference.autoNext) throw new Error('INVALID_AUTO_READ_PREFERENCES')
  const work = await getActiveNovelWork(workUuid)
  const updated = await db
    .insertInto('user_work_auto_read_preferences')
    .values({
      user_id: userId,
      p_id: work.p_id,
      auto_next: preference.autoNext,
      auto_purchase: preference.autoPurchase,
    })
    .onConflict((oc) => oc.columns(['user_id', 'p_id']).doUpdateSet({
      auto_next: preference.autoNext,
      auto_purchase: preference.autoPurchase,
      updated_at: new Date(),
    }))
    .returning(['auto_next', 'auto_purchase', 'updated_at'])
    .executeTakeFirstOrThrow()
  return updated
}

export async function createAdminTtsRequest(adminId: bigint, workUuid: string, episodeIds: string[], tier: TtsTier = 'basic') {
  const work = await getActiveNovelWork(workUuid)
  const selected = await getRequestableEpisodes(work.p_id, parseEpisodeIds(episodeIds))
  return createRequest({
    pId: work.p_id,
    requestedBy: adminId,
    requesterType: 'admin',
    tier,
    episodeIds: selected.map((episode) => episode.ep_id),
  })
}

export async function startTtsRequest(adminId: bigint, requestId: bigint) {
  const result = await db.transaction().execute(async (trx) => {
    const request = await trx
      .selectFrom('tts_requests')
      .selectAll()
      .where('id', '=', requestId)
      .forUpdate()
      .executeTakeFirst()
    if (!request) throw new Error('TTS_REQUEST_NOT_FOUND')
    if (request.status !== 'approval') throw new Error('TTS_REQUEST_NOT_AWAITING_APPROVAL')
    // Pro wiring is deployable before reference folders are populated, but an
    // explicit API interlock prevents an approval from unexpectedly consuming
    // the local voice files. The worker has the same independent guard.
    if (request.tier === 'pro' && !isProRenderEnabled()) throw new Error('TTS_PRO_RENDER_DISABLED')

    const items = await trx
      .selectFrom('tts_request_episodes as item')
      .innerJoin('work_ep as ep', 'ep.ep_id', 'item.ep_id')
      .select(['ep.ep_id', 'ep.ep_content'])
      .where('item.request_id', '=', request.id)
      .where('ep.status', '=', 'active')
      .forUpdate()
      .execute()
    const usable = items.filter((item) => item.ep_content?.some((block) => block.text.trim().length > 0))
    if (usable.length === 0) throw new Error('TTS_NO_CONTENT')

    const activeJobs = await trx
      .selectFrom('tts_jobs')
      .select('ep_id')
      .where('ep_id', 'in', usable.map((item) => item.ep_id))
      .where('status', 'in', ['pending', 'processing'])
      .execute()
    if (activeJobs.length > 0) throw new Error('TTS_EPISODE_BUSY')

    const assignments = request.tier === 'pro' ? await getProVoiceAssignments(trx, request.p_id) : null
    if (assignments) for (const item of usable) assertProBlocksHaveAssignedVoices(item.ep_content!, assignments)
    const jobsToQueue: Array<Insertable<DB['tts_jobs']>> = []
    for (const item of usable) {
      const common = {
        ep_id: item.ep_id,
        requested_by: request.requested_by,
        request_id: request.id,
        priority: request.priority,
        source_hash: getTtsSourceHash(item.ep_content!),
        status: 'pending' as const,
        voice_mode: 'multi' as const,
        voice_profile_version: TTS_VOICE_PROFILE_VERSION,
        max_attempts: 3,
        total_blocks: item.ep_content!.length,
      }
      if (request.tier === 'pro') {
        jobsToQueue.push({
          ...common,
          voice_slot: TTS_PRO_VOICE_SLOT,
          voice_assignments: assignments!,
          voice_assignment_hash: getProVoiceAssignmentHash(assignments!),
        })
      } else {
        for (const voice of TTS_VOICE_SLOTS) {
          jobsToQueue.push({ ...common, voice_slot: voice.id, voice_assignments: {}, voice_assignment_hash: '' })
        }
      }
    }
    await trx
      .insertInto('tts_jobs')
      .values(jobsToQueue)
      .execute()

    await trx
      .insertInto('tts_work_access')
      .values({ p_id: request.p_id, tier: request.tier, auto_update: true, enabled_by: adminId })
      .onConflict((oc) => oc.column('p_id').doUpdateSet({
        tier: request.tier,
        auto_update: true,
        enabled_by: adminId,
        updated_at: new Date(),
      }))
      .execute()

    const queued = await trx
      .updateTable('tts_requests')
      .set({
        status: 'queued',
        approved_by: adminId,
        approved_at: new Date(),
        queued_at: new Date(),
        rejection_reason: null,
        updated_at: new Date(),
      })
      .where('id', '=', request.id)
      .returningAll()
      .executeTakeFirstOrThrow()
    return queued
  })

  await writeAuditLog(adminId, 'TTS_REQUEST_STARTED', 'tts_request', String(requestId), 'Started TTS request')
  return serializeRequest(result)
}

export async function rejectTtsRequest(adminId: bigint, requestId: bigint, reason?: string) {
  const rejected = await db.transaction().execute(async (trx) => {
    const request = await trx
      .selectFrom('tts_requests')
      .selectAll()
      .where('id', '=', requestId)
      .forUpdate()
      .executeTakeFirst()
    if (!request) throw new Error('TTS_REQUEST_NOT_FOUND')
    if (request.status !== 'approval') throw new Error('TTS_REQUEST_NOT_AWAITING_APPROVAL')
    return trx
      .updateTable('tts_requests')
      .set({ status: 'rejected', approved_by: adminId, rejection_reason: reason?.trim() || null, updated_at: new Date() })
      .where('id', '=', request.id)
      .returningAll()
      .executeTakeFirstOrThrow()
  })
  await writeAuditLog(adminId, 'TTS_REQUEST_REJECTED', 'tts_request', String(requestId), 'Rejected TTS request')
  return serializeRequest(rejected)
}

export async function cancelTtsRequest(adminId: bigint, requestId: bigint) {
  const cancelled = await db.transaction().execute(async (trx) => {
    const request = await trx
      .selectFrom('tts_requests')
      .selectAll()
      .where('id', '=', requestId)
      .forUpdate()
      .executeTakeFirst()
    if (!request) throw new Error('TTS_REQUEST_NOT_FOUND')
    if (!['queued', 'processing'].includes(request.status)) throw new Error('TTS_REQUEST_NOT_CANCELLABLE')

    const jobs = await trx
      .updateTable('tts_jobs')
      .set({
        status: 'cancelled',
        error_message: 'CANCELLED_BY_ADMIN',
        failure_code: 'CANCELLED_BY_ADMIN',
        failure_stage: 'administration',
        retryable: true,
        cancelled_at: new Date(),
        lease_expires_at: null,
        current_block: null,
        updated_at: new Date(),
      })
      .where('request_id', '=', request.id)
      .where('status', 'in', ['pending', 'processing'])
      .returning(['id', 'request_id'])
      .execute()

    if (jobs.length === 0) throw new Error('TTS_REQUEST_NOT_CANCELLABLE')
    await trx
      .updateTable('tts_job_blocks')
      .set({ status: 'cancelled', error_code: 'CANCELLED_BY_ADMIN', error_message: 'Cancelled by Admin', updated_at: new Date() })
      .where('job_id', 'in', jobs.map((job) => job.id))
      .where('status', 'in', ['pending', 'processing'])
      .execute()
    for (const job of jobs) {
      await recordTtsJobEvent(trx, {
        jobId: job.id,
        requestId: job.request_id,
        type: 'manual_cancel',
        severity: 'warning',
        code: 'CANCELLED_BY_ADMIN',
        message: 'Render cancelled by Admin',
      })
    }
    return trx
      .updateTable('tts_requests')
      .set({ status: 'cancelled', completed_at: new Date(), updated_at: new Date() })
      .where('id', '=', request.id)
      .returningAll()
      .executeTakeFirstOrThrow()
  })
  await writeAuditLog(adminId, 'TTS_REQUEST_CANCELLED', 'tts_request', String(requestId), 'Cancelled TTS request')
  return serializeRequest(cancelled)
}

export async function retryTtsRequest(adminId: bigint, requestId: bigint) {
  const retried = await db.transaction().execute(async (trx) => {
    const request = await trx
      .selectFrom('tts_requests')
      .selectAll()
      .where('id', '=', requestId)
      .forUpdate()
      .executeTakeFirst()
    if (!request) throw new Error('TTS_REQUEST_NOT_FOUND')
    if (!['failed', 'cancelled'].includes(request.status)) throw new Error('TTS_REQUEST_NOT_RETRYABLE')

    const jobs = await trx
      .selectFrom('tts_jobs as job')
      .innerJoin('work_ep as ep', 'ep.ep_id', 'job.ep_id')
      .select(['job.id', 'job.request_id', 'job.source_hash', 'job.status', 'ep.ep_content'])
      .where('job.request_id', '=', request.id)
      .where('job.status', 'in', ['failed', 'cancelled'])
      .forUpdate()
      .execute()

    let retryCount = 0
    for (const job of jobs) {
      // Never rerender an obsolete revision. A normal edit already invalidates
      // active jobs; this also protects manual retries from old history.
      if (!job.ep_content || getTtsSourceHash(job.ep_content) !== job.source_hash) {
        await trx
          .updateTable('tts_jobs')
          .set({
            status: 'cancelled',
            error_message: 'CONTENT_CHANGED',
            failure_code: 'CONTENT_CHANGED',
            failure_stage: 'validation',
            retryable: false,
            cancelled_at: new Date(),
            updated_at: new Date(),
          })
          .where('id', '=', job.id)
          .execute()
        await recordTtsJobEvent(trx, {
          jobId: job.id,
          requestId: job.request_id,
          type: 'cancelled',
          severity: 'warning',
          code: 'CONTENT_CHANGED',
          message: 'Manual retry skipped because the episode content changed',
        })
        continue
      }

      await trx
        .updateTable('tts_jobs')
        .set({
          status: 'pending',
          attempt_count: 0,
          worker_id: null,
          lease_expires_at: null,
          available_at: new Date(),
          completed_blocks: 0,
          current_block: null,
          progress_updated_at: null,
          error_message: null,
          failure_code: null,
          failure_stage: null,
          retryable: null,
          last_error_at: null,
          cancelled_at: null,
          completed_at: null,
          updated_at: new Date(),
        })
        .where('id', '=', job.id)
        .execute()
      await trx
        .updateTable('tts_job_blocks')
        .set({
          status: 'pending',
          duration_seconds: null,
          start_seconds: null,
          end_seconds: null,
          error_code: null,
          error_message: null,
          started_at: null,
          completed_at: null,
          updated_at: new Date(),
        })
        .where('job_id', '=', job.id)
        .execute()
      await recordTtsJobEvent(trx, {
        jobId: job.id,
        requestId: job.request_id,
        type: 'manual_retry',
        severity: 'info',
        message: 'Admin queued this voice render for a fresh retry',
      })
      retryCount += 1
    }
    if (retryCount === 0) throw new Error('TTS_REQUEST_NOT_RETRYABLE')
    const queued = await trx
      .updateTable('tts_requests')
      .set({ status: 'queued', queued_at: new Date(), completed_at: null, updated_at: new Date() })
      .where('id', '=', request.id)
      .returningAll()
      .executeTakeFirstOrThrow()
    return { request: queued, retryCount }
  })
  await writeAuditLog(adminId, 'TTS_REQUEST_RETRIED', 'tts_request', String(requestId), `Retried ${retried.retryCount} TTS jobs`)
  return { ...serializeRequest(retried.request), retried_jobs: retried.retryCount }
}

export async function enqueueAutoTtsForEpisode(epId: bigint) {
  return db.transaction().execute(async (trx) => {
    const episode = await trx
      .selectFrom('work_ep as ep')
      .innerJoin('works as work', 'work.p_id', 'ep.p_id')
      .innerJoin('tts_work_access as access', 'access.p_id', 'work.p_id')
      .select(['ep.ep_id', 'ep.p_id', 'ep.ep_content', 'ep.publish_status', 'work.type', 'work.status', 'access.tier', 'access.auto_update'])
      .where('ep.ep_id', '=', epId)
      .where('ep.status', '=', 'active')
      .where('work.status', '=', 'active')
      .forUpdate()
      .executeTakeFirst()
    if (!episode || episode.type !== 'novel' || !episode.auto_update || episode.publish_status === 'hide') return null
    if (!episode.ep_content?.some((block) => block.text.trim().length > 0)) return null
    if (episode.tier === 'pro' && !isProRenderEnabled()) return null

    const sourceHash = getTtsSourceHash(episode.ep_content)
    const assignments = episode.tier === 'pro' ? await getProVoiceAssignments(trx, episode.p_id) : null
    if (assignments) assertProBlocksHaveAssignedVoices(episode.ep_content, assignments)
    const assignmentHash = assignments ? getProVoiceAssignmentHash(assignments) : null
    const completedJobs = await trx
      .selectFrom('tts_jobs')
      .select(['voice_slot', 'voice_assignment_hash'])
      .where('ep_id', '=', episode.ep_id)
      .where('source_hash', '=', sourceHash)
      .where('status', '=', 'done')
      .execute()
    const completedSlots = new Set(completedJobs
      .filter((job) => episode.tier !== 'pro' || job.voice_assignment_hash === assignmentHash)
      .map((job) => job.voice_slot))
    const missingSlots: TtsVoiceSlot[] = episode.tier === 'pro'
      ? (completedSlots.has(TTS_PRO_VOICE_SLOT) ? [] : [TTS_PRO_VOICE_SLOT])
      : TTS_VOICE_SLOTS.filter((voice) => !completedSlots.has(voice.id)).map((voice) => voice.id)
    if (missingSlots.length === 0) return null

    const activeJob = await trx
      .selectFrom('tts_jobs')
      .select('id')
      .where('ep_id', '=', episode.ep_id)
      .where('status', 'in', ['pending', 'processing'])
      .executeTakeFirst()
    if (activeJob) return null

    let request = await trx
      .selectFrom('tts_requests')
      .selectAll()
      .where('p_id', '=', episode.p_id)
      .where('requester_type', '=', 'system_update')
      .where('status', 'in', ['queued', 'processing'])
      .orderBy('requested_at', 'asc')
      .forUpdate()
      .executeTakeFirst()

    if (!request) {
      request = await trx
        .insertInto('tts_requests')
        .values({
          p_id: episode.p_id,
          requester_type: 'system_update',
          tier: episode.tier,
          status: 'queued',
          auto_update: true,
          priority: 100,
          queued_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow()
    } else if (request.status === 'processing') {
      request = await trx
        .updateTable('tts_requests')
        .set({ status: 'queued', updated_at: new Date() })
        .where('id', '=', request.id)
        .returningAll()
        .executeTakeFirstOrThrow()
    }

    await trx
      .insertInto('tts_request_episodes')
      .values({ request_id: request.id, ep_id: episode.ep_id })
      .onConflict((oc) => oc.columns(['request_id', 'ep_id']).doNothing())
      .execute()
    await trx
      .insertInto('tts_jobs')
      .values(missingSlots.map((voice) => ({
        ep_id: episode.ep_id,
        request_id: request.id,
        priority: 100,
        source_hash: sourceHash,
        ...(voice === TTS_PRO_VOICE_SLOT
          ? { voice_assignments: assignments!, voice_assignment_hash: assignmentHash! }
          : { voice_assignments: {}, voice_assignment_hash: '' }),
        status: 'pending' as const,
        voice_mode: 'multi' as const,
        voice_slot: voice,
        voice_profile_version: TTS_VOICE_PROFILE_VERSION,
        max_attempts: 3,
        total_blocks: episode.ep_content!.length,
      })))
      .execute()
    return request
  })
}

// A writer may edit narration only after the work has already received TTS
// access. This creates a new, auto-approved request for one episode; it never
// grants TTS to a new work and stays below system updates (priority 100).
export async function queueWriterTtsEdit(userId: bigint, epId: bigint, voiceSlots?: TtsVoiceSlot[]) {
  const result = await db.transaction().execute(async (trx) => {
    const episode = await trx
      .selectFrom('work_ep as ep')
      .innerJoin('works as work', 'work.p_id', 'ep.p_id')
      .innerJoin('tts_work_access as access', 'access.p_id', 'work.p_id')
      .select(['ep.ep_id', 'ep.p_id', 'ep.ep_content', 'work.author_id', 'work.type', 'work.status', 'access.tier'])
      .where('ep.ep_id', '=', epId)
      .where('ep.status', '=', 'active')
      .where('work.status', '=', 'active')
      .forUpdate()
      .executeTakeFirst()

    // เหตุผลเดียวกับ ownership check ข้างบน: BIGINT จาก PostgreSQL เป็น string ตอน runtime
    if (!episode || String(episode.author_id) !== userId.toString()) throw new Error('EPISODE_NOT_FOUND')
    if (episode.type !== 'novel') throw new Error('NOT_NOVEL')
    if (!episode.ep_content || episode.ep_content.length === 0) throw new Error('TTS_NO_CONTENT')
    if (episode.tier === 'pro' && !isProRenderEnabled()) throw new Error('TTS_PRO_RENDER_DISABLED')
    const slotsToQueue: TtsVoiceSlot[] = episode.tier === 'pro'
      ? [TTS_PRO_VOICE_SLOT]
      : voiceSlots && voiceSlots.length > 0
        ? TTS_VOICE_SLOTS.filter((voice) => voiceSlots.includes(voice.id)).map((voice) => voice.id)
        : TTS_VOICE_SLOTS.map((voice) => voice.id)
    if (episode.tier === 'basic' && voiceSlots?.includes(TTS_PRO_VOICE_SLOT)) throw new Error('TTS_NO_VOICE_SLOTS_SELECTED')
    const assignments = episode.tier === 'pro' ? await getProVoiceAssignments(trx, episode.p_id) : null
    if (assignments) assertProBlocksHaveAssignedVoices(episode.ep_content, assignments)

    const active = await trx
      .selectFrom('tts_jobs')
      .select('id')
      .where('ep_id', '=', episode.ep_id)
      .where('status', 'in', ['pending', 'processing'])
      .executeTakeFirst()
    if (active) throw new Error('TTS_EPISODE_BUSY')
    if (slotsToQueue.length === 0) throw new Error('TTS_NO_VOICE_SLOTS_SELECTED')

    const request = await trx
      .insertInto('tts_requests')
      .values({
        p_id: episode.p_id,
        requested_by: userId,
        requester_type: 'writer_edit',
        tier: episode.tier,
        status: 'queued',
        source_episode_id: episode.ep_id,
        auto_update: false,
        priority: 0,
        approved_at: new Date(),
        queued_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    await trx.insertInto('tts_request_episodes').values({ request_id: request.id, ep_id: episode.ep_id }).execute()
    await trx
      .insertInto('tts_jobs')
      .values(slotsToQueue.map((voice) => ({
        ep_id: episode.ep_id,
        requested_by: userId,
        request_id: request.id,
        priority: 0,
        source_hash: getTtsSourceHash(episode.ep_content!),
        ...(voice === TTS_PRO_VOICE_SLOT
          ? { voice_assignments: assignments!, voice_assignment_hash: getProVoiceAssignmentHash(assignments!) }
          : { voice_assignments: {}, voice_assignment_hash: '' }),
        status: 'pending' as const,
        voice_mode: 'multi' as const,
        voice_slot: voice,
        voice_profile_version: TTS_VOICE_PROFILE_VERSION,
        max_attempts: 3,
        total_blocks: episode.ep_content!.length,
      })))
      .execute()
    return request
  })

  await writeAuditLog(userId, 'TTS_EDIT_QUEUED', 'tts_request', String(result.id), `Queued TTS edit for episode ${epId}`)
  return serializeRequest(result)
}

export async function listTtsRequestsForAdmin(tab: 'approval' | 'queue' | 'history') {
  const statuses: TtsRequestStatus[] = tab === 'approval'
    ? ['approval']
    : tab === 'queue'
      ? ['queued', 'processing']
      : ['completed', 'failed', 'cancelled', 'rejected']

  const rows = await db
    .selectFrom('tts_requests as request')
    .innerJoin('works as work', 'work.p_id', 'request.p_id')
    .leftJoin('users as requester', 'requester.id', 'request.requested_by')
    .select([
      'request.id', 'request.p_id', 'request.requested_by', 'request.requester_type', 'request.tier', 'request.status',
      'request.source_episode_id', 'request.auto_update', 'request.priority', 'request.requested_at', 'request.approved_at',
      'request.queued_at', 'request.completed_at', 'work.uuid as work_uuid', 'work.title as work_title', 'work.view_count',
      'requester.display_name as requester_name',
    ])
    .where('request.status', 'in', statuses)
    .orderBy('request.priority', 'desc')
    .orderBy('request.requested_at', 'asc')
    .execute()

  if (rows.length === 0) return []
  const ids = rows.map((row) => row.id)
  const [episodes, jobs, events] = await Promise.all([
    db
      .selectFrom('tts_request_episodes as item')
      .innerJoin('work_ep as ep', 'ep.ep_id', 'item.ep_id')
      .select(['item.request_id', 'ep.ep_id', 'ep.ep_no', 'ep.ep_name'])
      .where('item.request_id', 'in', ids)
      .orderBy('ep.ep_no', 'asc')
      .execute(),
    db
      .selectFrom('tts_jobs')
      .select([
        'id', 'request_id', 'status', 'total_blocks', 'completed_blocks', 'current_block', 'error_message',
        'failure_code', 'failure_stage', 'retryable', 'available_at', 'last_error_at',
      ])
      .where('request_id', 'in', ids)
      .execute(),
    db
      .selectFrom('tts_job_events')
      .select(['job_id', 'request_id', 'event_type', 'severity', 'code', 'message', 'created_at'])
      .where('request_id', 'in', ids)
      .orderBy('created_at', 'desc')
      .execute(),
  ])

  return rows.map((row) => {
    const requestEpisodes = episodes.filter((episode) => episode.request_id === row.id).map((episode) => ({
      id: String(episode.ep_id), no: episode.ep_no, name: episode.ep_name,
    }))
    const requestJobs = jobs.filter((job) => job.request_id === row.id)
    const byStatus = requestJobs.reduce<Record<string, number>>((counts, job) => {
      counts[job.status] = (counts[job.status] ?? 0) + 1
      return counts
    }, {})
    const completedBlocks = requestJobs.reduce((total, job) => total + job.completed_blocks, 0)
    const totalBlocks = requestJobs.reduce((total, job) => total + job.total_blocks, 0)
    const latestFailure = requestJobs.find((job) => job.failure_code || job.error_message)
    const nextRetryAt = requestJobs
      .filter((job) => job.status === 'pending' && job.error_message)
      .map((job) => job.available_at)
      .sort((left, right) => left.getTime() - right.getTime())[0] ?? null
    const requesterLabel = row.requester_type === 'reader'
      ? `ผู้ต้องการ TTS (#${row.id})`
      : row.requester_type === 'system_update'
        ? 'อัปเดตตอนใหม่อัตโนมัติ'
        : row.requester_type === 'writer_edit'
          ? row.requester_name ?? 'นักเขียน (แก้ไขเสียง)'
          : row.requester_name ?? (row.requester_type === 'admin' ? 'แอดมิน' : 'นักเขียน')
    return {
      ...serializeRequest(row),
      work: { uuid: row.work_uuid, title: row.work_title, view_count: String(row.view_count) },
      requester: { type: row.requester_type, label: requesterLabel },
      episodes: requestEpisodes,
      jobs: {
        total: requestJobs.length,
        by_status: byStatus,
        completed_blocks: completedBlocks,
        total_blocks: totalBlocks,
        current_block: requestJobs.find((job) => job.current_block !== null)?.current_block ?? null,
        error_message: requestJobs.find((job) => job.error_message)?.error_message ?? null,
        failure_code: latestFailure?.failure_code ?? null,
        failure_stage: latestFailure?.failure_stage ?? null,
        retryable: latestFailure?.retryable ?? false,
        next_retry_at: nextRetryAt,
      },
      events: events
        .filter((event) => event.request_id === row.id)
        .slice(0, 4)
        .map((event) => ({
          job_id: String(event.job_id),
          type: event.event_type,
          severity: event.severity,
          code: event.code,
          message: event.message,
          created_at: event.created_at,
        })),
    }
  })
}

export async function getTtsWorkerHealth() {
  const worker = await db
    .selectFrom('tts_worker_heartbeats')
    .selectAll()
    .orderBy('last_seen_at', 'desc')
    .executeTakeFirst()
  if (!worker) return { online: false, last_seen_at: null, uptime_seconds: null, worker_id: null, current_job_id: null }
  const now = Date.now()
  return {
    online: now - worker.last_seen_at.getTime() <= 10 * 60 * 1000,
    last_seen_at: worker.last_seen_at,
    uptime_seconds: Math.max(0, Math.floor((now - worker.started_at.getTime()) / 1000)),
    worker_id: worker.worker_id,
    current_job_id: worker.current_job_id === null ? null : String(worker.current_job_id),
  }
}

async function refreshTtsRequestStatus(requestId: bigint) {
  const jobs = await db
    .selectFrom('tts_jobs')
    .select('status')
    .where('request_id', '=', requestId)
    .execute()
  if (jobs.length === 0) return
  const statuses = jobs.map((job) => job.status)
  const next: TtsRequestStatus = statuses.includes('processing')
    ? 'processing'
    : statuses.includes('pending')
      ? 'queued'
      : statuses.every((status) => status === 'done')
        ? 'completed'
        : statuses.includes('failed')
          ? 'failed'
          : 'cancelled'
  await db
    .updateTable('tts_requests')
    .set({
      status: next,
      completed_at: ['completed', 'failed', 'cancelled'].includes(next) ? new Date() : undefined,
      updated_at: new Date(),
    })
    .where('id', '=', requestId)
    .where('status', 'in', ['queued', 'processing'])
    .execute()
}

export async function invalidateTtsForEpisode(epId: bigint) {
  const cancelled = await db
    .updateTable('tts_jobs')
    .set({
      status: 'cancelled',
      error_message: 'CONTENT_CHANGED',
      failure_code: 'CONTENT_CHANGED',
      failure_stage: 'validation',
      retryable: false,
      cancelled_at: new Date(),
      lease_expires_at: null,
      current_block: null,
      updated_at: new Date(),
    })
    .where('ep_id', '=', epId)
    .where('status', 'in', ['pending', 'processing'])
    .returning(['id', 'request_id'])
    .execute()
  await Promise.all(cancelled.map((job) => recordTtsJobEvent(db, {
    jobId: job.id,
    requestId: job.request_id,
    type: 'cancelled',
    severity: 'warning',
    code: 'CONTENT_CHANGED',
    message: 'Render cancelled because the episode content changed',
  })))
  await Promise.all(cancelled
    .map((job) => job.request_id)
    .filter((requestId): requestId is bigint => requestId !== null)
    .map((requestId) => refreshTtsRequestStatus(requestId)))
}

// Character aliases or voice categories are work-level configuration. A Pro
// job carries its own immutable snapshot, so any queued/processing Pro job
// must be cancelled when that configuration changes rather than rendering a
// now-obsolete plan.
export async function invalidateProTtsForWork(pId: bigint) {
  const cancelled = await db
    .updateTable('tts_jobs as job')
    .set({
      status: 'cancelled',
      error_message: 'VOICE_ASSIGNMENTS_CHANGED',
      failure_code: 'VOICE_ASSIGNMENTS_CHANGED',
      failure_stage: 'validation',
      retryable: false,
      cancelled_at: new Date(),
      lease_expires_at: null,
      current_block: null,
      updated_at: new Date(),
    })
    .from('work_ep as ep')
    .whereRef('job.ep_id', '=', 'ep.ep_id')
    .where('ep.p_id', '=', pId)
    .where('job.voice_slot', '=', TTS_PRO_VOICE_SLOT)
    .where('job.status', 'in', ['pending', 'processing'])
    .returning(['job.id', 'job.request_id'])
    .execute()
  await Promise.all(cancelled.map((job) => recordTtsJobEvent(db, {
    jobId: job.id,
    requestId: job.request_id,
    type: 'cancelled',
    severity: 'warning',
    code: 'VOICE_ASSIGNMENTS_CHANGED',
    message: 'Render cancelled because the Pro voice assignments changed',
  })))
  await Promise.all(cancelled
    .map((job) => job.request_id)
    .filter((requestId): requestId is bigint => requestId !== null)
    .map((requestId) => refreshTtsRequestStatus(requestId)))
}

export async function getEpisodeAudioForBlocks(epId: bigint, blocks: NovelBlock[]) {
  if (blocks.length === 0) return null
  const sourceHash = getTtsSourceHash(blocks)
  const episode = await db
    .selectFrom('work_ep')
    .select('p_id')
    .where('ep_id', '=', epId)
    .executeTakeFirst()
  const access = episode
    ? await db.selectFrom('tts_work_access').select('tier').where('p_id', '=', episode.p_id).executeTakeFirst()
    : null
  const isPro = access?.tier === 'pro'
  const assignments = isPro && episode ? await getProVoiceAssignments(db, episode.p_id) : null
  const assignmentHash = assignments ? getProVoiceAssignmentHash(assignments) : null
  const jobs = await db
    .selectFrom('tts_jobs')
    .select(['id', 'voice_slot', 'voice_profile_version', 'voice_assignment_hash', 'audio_url', 'duration_seconds'])
    .where('ep_id', '=', epId)
    .where('source_hash', '=', sourceHash)
    .where('status', '=', 'done')
    .orderBy('completed_at', 'desc')
    .execute()
  const relevantJobs = jobs.filter((job) => isPro
    ? job.voice_slot === TTS_PRO_VOICE_SLOT && job.voice_assignment_hash === assignmentHash
    : job.voice_slot !== TTS_PRO_VOICE_SLOT)
  const newestBySlot = new Map<TtsVoiceSlot, typeof jobs[number]>()
  for (const job of relevantJobs) {
    if (!newestBySlot.has(job.voice_slot)) newestBySlot.set(job.voice_slot, job)
  }
  const newestJobs = [...newestBySlot.values()]
  const jobBlocks = newestJobs.length === 0
    ? []
    : await db
      .selectFrom('tts_job_blocks')
      .select(['job_id', 'block_id', 'start_seconds', 'end_seconds'])
      .where('job_id', 'in', newestJobs.map((job) => job.id))
      .where('status', '=', 'done')
      .orderBy('block_index', 'asc')
      .execute()
  const timestampsByJob = new Map<bigint, Record<string, { start: number; end: number }>>()
  for (const block of jobBlocks) {
    if (block.start_seconds == null || block.end_seconds == null) continue
    const timestamps = timestampsByJob.get(block.job_id) ?? {}
    timestamps[block.block_id] = { start: block.start_seconds, end: block.end_seconds }
    timestampsByJob.set(block.job_id, timestamps)
  }
  const availableSlots: ReadonlyArray<{ id: TtsVoiceSlot; label: string }> = isPro
    ? [{ id: TTS_PRO_VOICE_SLOT, label: 'Pro TTS' }]
    : TTS_VOICE_SLOTS
  const variants = availableSlots.flatMap((voice) => {
    const job = newestBySlot.get(voice.id)
    if (!job?.audio_url || job.duration_seconds == null) return []
    return [{
      slot: voice.id,
      label: voice.label,
      version: job.voice_profile_version,
      url: job.audio_url,
      duration_seconds: job.duration_seconds,
      // Timecode must belong to the same rendered audio variant.  ep_content.audio_ts
      // is retained only as a legacy cache and is overwritten when another voice
      // variant completes, so readers must never use it for multi-voice playback.
      timestamps: timestampsByJob.get(job.id) ?? {},
    }]
  })
  return variants.length > 0 ? { variants } : null
}
