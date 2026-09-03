import { randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import { db } from '../../db'
import type { NovelBlock, NovelBlockStyle, NovelBlockTts } from '../../db/types'
import { clearAudioTimestamps, getProVoiceAssignmentHash, getProVoiceAssignments, getTtsSourceHash, invalidateProTtsForWork, invalidateTtsForEpisode, preserveAudioTimestamps, queueWriterTtsEdit, TTS_PRO_VOICE_SLOT, TTS_VOICE_SLOTS } from './tts.service'
import type { TtsVoiceSlot } from './tts.service'

const MAX_BLOCKS = 2_000
const MAX_BLOCK_TEXT = 8_000
const MAX_DRAFT_BYTES = 1_000_000
const CHARACTER_SHORTCUT = /^[\p{L}][\p{L}\p{N}_-]{0,30}$/u

export const TTS_EDITOR_CORE_COMMANDS = [
  { shortcut: '//1', label: 'เว้นสั้น', description: 'เว้น 0.25 วินาที', supported: true },
  { shortcut: '//2', label: 'เว้นปกติ', description: 'เว้น 0.5 วินาที', supported: true },
  { shortcut: '//3', label: 'เว้นยาว', description: 'เว้น 1 วินาที', supported: true },
  { shortcut: '//4', label: 'เปลี่ยนจังหวะ', description: 'เว้น 2 วินาที', supported: true },
  { shortcut: '//5', label: 'ข้ามบล็อก', description: 'ไม่สร้างเสียงให้บล็อกนี้', supported: true },
  { shortcut: '//6', label: 'จังหวะหายใจ', description: 'เว้น 0.25 วินาที (ไม่ใช่เสียงลมหายใจจริง)', supported: true },
] as const

const CORE_PAUSES: Record<string, number> = {
  '1': 0.25,
  '2': 0.5,
  '3': 1,
  '4': 2,
  '6': 0.25,
}

export type TtsEditorVoiceSlotInput = {
  slot_no: number
  shortcuts: string[]
  voice_category?: string  // free-text: "handsome" (auto), "handsome_3" (pin), "handsome_3!" (pin, shared) — ดู Tier1_DesignCore.md ข้อ 4
}

export type TtsEditorBlockInput = {
  id?: string
  display_label?: string
  text: string
  style?: NovelBlockStyle | null
  block_kind?: 'narration' | 'gap'
  gap_seconds?: number
  emotion?: 'neutral' | 'sad' | 'angry' | 'happy' | 'excited' | 'fear'
}

type StoredVoiceSlot = TtsEditorVoiceSlotInput & {
  id: bigint | null
  display_name: string
  voice_role: 'lead' | 'supporting' | 'extra'
  gender: 'male' | 'female'
  color: string
  voice_index: number | null
  voice_shared: boolean
}

function cleanShortcut(value: string) {
  return value.trim().replace(/^\/\//, '')
}

// category อาจมี underscore ได้ (handsome_male) และ suffix ตัวเลขเป็น
// reservation index เสมอ (handsome_male_3!). การยอมรับ underscore สำคัญ
// เพราะ TTSCore ใช้ suffix _male/_female เพื่อเลือก extra_<gender> fallback.
const VOICE_CATEGORY_INPUT = /^([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z][A-Za-z0-9]*)*)(?:_([1-9][0-9]*))?(!)?$/

function parseVoiceCategoryInput(raw: string): { category: string; explicitIndex: number | null; shared: boolean } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const match = VOICE_CATEGORY_INPUT.exec(trimmed)
  if (!match) throw new Error('TTS_EDITOR_INVALID_VOICE_CATEGORY')
  return { category: match[1].toLowerCase(), explicitIndex: match[2] ? Number(match[2]) : null, shared: Boolean(match[3]) }
}

function cleanVisibleText(value: string) {
  return value
    .replace(/\/\/(?:[1-9]|1[0-9]|20)(?![A-Za-z0-9_-])/g, '')
    .replace(/\/\/[\p{L}][\p{L}\p{N}_-]{0,30}/gu, '')
    .replace(/\{(?:pause\s*:\s*[0-9]+(?:\.[0-9]+)?|skip|breath)\}/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function normalizeBlock(input: TtsEditorBlockInput, labels: StoredVoiceSlot[], index: number): NovelBlock {
  const rawText = String(input.text ?? '')
  if (rawText.length > MAX_BLOCK_TEXT) throw new Error('TTS_EDITOR_BLOCK_TOO_LONG')
  const id = input.id?.trim() || `tts_${randomUUID()}`
  if (!/^[A-Za-z0-9_-]{1,96}$/.test(id)) throw new Error('TTS_EDITOR_INVALID_BLOCK_ID')

  if (input.block_kind === 'gap') {
    const seconds = Number(input.gap_seconds ?? 1)
    if (!Number.isFinite(seconds) || seconds < 0.1 || seconds > 15) throw new Error('TTS_EDITOR_INVALID_GAP')
    return {
      id,
      display_label: input.display_label?.trim() || 'gap',
      text: '',
      style: input.style ?? null,
      audio_ts: null,
      tts: { block_kind: 'gap', gap_seconds: Math.round(seconds * 100) / 100 },
    }
  }

  const shortcuts = [...rawText.matchAll(/\/\/([\p{L}\p{N}_-]+)/gu)].map((match) => match[1])
  let skip = rawText.trim().toLowerCase() === 'none' || /\{skip\}/i.test(rawText)
  let speakerSlot: number | undefined
  for (const shortcut of shortcuts) {
    if (/^\d+$/.test(shortcut)) {
      const number = Number(shortcut)
      if (number < 1 || number > 20) throw new Error('TTS_EDITOR_INVALID_COMMAND')
      if (number === 5) skip = true
      if (!Object.prototype.hasOwnProperty.call(CORE_PAUSES, shortcut) && number !== 5) throw new Error('TTS_EDITOR_RESERVED_COMMAND')
      continue
    }
    const character = labels.find((label) => label.shortcuts.some((alias) => alias.toLowerCase() === shortcut.toLowerCase()))
    if (!character) throw new Error('TTS_EDITOR_UNKNOWN_CHARACTER_SHORTCUT')
    if (speakerSlot !== undefined && speakerSlot !== character.slot_no) throw new Error('TTS_EDITOR_MULTIPLE_CHARACTERS')
    speakerSlot = character.slot_no
  }

  const explicitPauses = [...rawText.matchAll(/\{pause\s*:\s*([0-9]+(?:\.[0-9]+)?)\}/gi)]
  if (explicitPauses.some((match) => Number(match[1]) > 15)) throw new Error('TTS_EDITOR_INVALID_GAP')

  const visibleText = skip ? (rawText.trim().toLowerCase() === 'none' ? '' : cleanVisibleText(rawText)) : cleanVisibleText(rawText)
  const hasDirective = visibleText !== rawText.trim() || shortcuts.length > 0 || explicitPauses.length > 0 || /\{(?:skip|breath)\}/i.test(rawText)
  const tts: NovelBlockTts = { block_kind: 'narration' }
  if (skip) tts.skip = true
  if (speakerSlot !== undefined) tts.speaker_slot = speakerSlot
  if (input.emotion) tts.emotion = input.emotion

  return {
    id,
    display_label: input.display_label?.trim().slice(0, 120) || 'narration',
    text: visibleText,
    style: input.style ?? null,
    audio_ts: null,
    ...(hasDirective ? { tts_text: rawText.trim() } : {}),
    ...(Object.keys(tts).length > 1 ? { tts } : {}),
  }
}

function validateVoiceSlots(labels: TtsEditorVoiceSlotInput[]) {
  if (labels.length > 7) throw new Error('TTS_EDITOR_TOO_MANY_CHARACTERS')
  const slots = new Set<number>()
  const shortcuts = new Set<string>()
  for (const label of labels) {
    if (!Number.isInteger(label.slot_no) || label.slot_no < 0 || label.slot_no > 6) throw new Error('TTS_EDITOR_INVALID_CHARACTER')
    if (!Array.isArray(label.shortcuts) || label.shortcuts.length > 30 || (label.slot_no === 0 && label.shortcuts.length > 0)) {
      throw new Error('TTS_EDITOR_INVALID_CHARACTER')
    }
    for (const rawShortcut of label.shortcuts) {
      const shortcut = cleanShortcut(rawShortcut)
      if (!CHARACTER_SHORTCUT.test(shortcut) || /^\d+$/.test(shortcut)) throw new Error('TTS_EDITOR_INVALID_CHARACTER')
      if (shortcuts.has(shortcut.toLowerCase())) throw new Error('TTS_EDITOR_DUPLICATE_CHARACTER')
      shortcuts.add(shortcut.toLowerCase())
    }
    parseVoiceCategoryInput(label.voice_category ?? '') // throws TTS_EDITOR_INVALID_VOICE_CATEGORY ถ้ารูปแบบผิด
    if (slots.has(label.slot_no)) throw new Error('TTS_EDITOR_DUPLICATE_CHARACTER')
    slots.add(label.slot_no)
  }
}

async function getOwnedEditorEpisode(userId: bigint, workUuid: string, epId: bigint) {
  const episode = await db
    .selectFrom('work_ep as ep')
    .innerJoin('works as work', 'work.p_id', 'ep.p_id')
    .innerJoin('tts_work_access as access', 'access.p_id', 'work.p_id')
    .select([
      'ep.ep_id', 'ep.p_id', 'ep.ep_no', 'ep.ep_name', 'ep.ep_content', 'ep.updated_at',
      'work.uuid as work_uuid', 'work.title as work_title', 'work.author_id', 'work.type', 'work.status', 'access.tier',
    ])
    .where('ep.ep_id', '=', epId)
    .where('work.uuid', '=', workUuid)
    .where('ep.status', '=', 'active')
    .where('work.status', '=', 'active')
    .executeTakeFirst()
  // node-postgres may deserialize BIGINT as string while the JWT id is BigInt.
  // Compare their canonical decimal values; a strict `string !== bigint` check
  // would reject the actual owner and make the editor look as though it failed
  // to load.
  if (!episode || String(episode.author_id) !== userId.toString()) throw new Error('EPISODE_NOT_FOUND')
  if (episode.type !== 'novel') throw new Error('NOT_NOVEL')
  return episode
}

// ของเก่าใน DB ที่ยังไม่เคย resave ผ่านตัวไหนเลยหลัง 2026-08-16 จะยังมี key เดิม (label/tts.kind)
// ไม่มี display_label/tts.block_kind เลย — normalize ตอนอ่านให้ editor เห็นค่าที่ถูกต้องเสมอ ไม่งั้น
// พอ user กด "บันทึก" โดยไม่ได้แตะ block นั้นเลย จะเขียนทับด้วยค่า default ('narration') สูญข้อมูลเดิม
function normalizeStoredNovelBlock(raw: NovelBlock): NovelBlock {
  const legacy = raw as NovelBlock & { label?: string }
  const display_label = raw.display_label ?? legacy.label ?? 'paragraph'
  if (!raw.tts) return { ...raw, display_label }
  const legacyTts = raw.tts as NovelBlockTts & { kind?: 'narration' | 'gap' }
  return { ...raw, display_label, tts: { ...raw.tts, block_kind: raw.tts.block_kind ?? legacyTts.kind } }
}

function emptyVoiceSlot(slotNo: number): StoredVoiceSlot {
  return {
    id: null,
    slot_no: slotNo,
    shortcuts: [],
    voice_category: undefined,
    voice_index: null,
    voice_shared: false,
    display_name: slotNo === 0 ? 'Narrator' : `ช่องเสียง ${slotNo}`,
    voice_role: slotNo === 0 ? 'lead' : 'supporting',
    gender: 'female',
    color: slotNo === 0 ? '#f97316' : '#7c3aed',
  }
}

async function listVoiceSlots(pId: bigint): Promise<StoredVoiceSlot[]> {
  const [labels, aliases] = await Promise.all([
    db.selectFrom('tts_work_character_labels').selectAll().where('p_id', '=', pId).orderBy('slot_no', 'asc').execute(),
    db.selectFrom('tts_work_character_shortcuts').select(['label_id', 'shortcut']).where('p_id', '=', pId).orderBy('shortcut', 'asc').execute(),
  ])
  return Array.from({ length: 7 }, (_, slotNo) => {
    const label = labels.find((item) => item.slot_no === slotNo)
    if (!label) return emptyVoiceSlot(slotNo)
    const childAliases = aliases.filter((item) => item.label_id === label.id).map((item) => item.shortcut)
    const shortcuts = childAliases.length > 0
      ? childAliases
      : label.shortcut ? [label.shortcut] : []
    return {
      id: label.id,
      slot_no: label.slot_no,
      shortcuts,
      voice_category: label.voice_category ?? undefined,
      voice_index: label.voice_index,
      voice_shared: label.voice_shared,
      display_name: label.display_name,
      voice_role: label.voice_role,
      gender: label.gender,
      color: label.color,
    }
  })
}

export async function getTtsEditorWorkOverview(userId: bigint, workUuid: string) {
  const work = await db
    .selectFrom('works as work')
    .leftJoin('tts_work_access as access', 'access.p_id', 'work.p_id')
    .select(['work.p_id', 'work.uuid', 'work.title', 'work.author_id', 'work.type', 'work.status', 'access.tier'])
    .where('work.uuid', '=', workUuid)
    .executeTakeFirst()

  if (!work || String(work.author_id) !== userId.toString() || work.status !== 'active') throw new Error('WORK_NOT_FOUND')
  if (work.type !== 'novel') throw new Error('NOT_NOVEL')

  const episodes = await db
    .selectFrom('work_ep as ep')
    .select(['ep.ep_id', 'ep.ep_no', 'ep.ep_name', 'ep.ep_content', 'ep.publish_status', 'ep.updated_at'])
    .where('ep.p_id', '=', work.p_id)
    .where('ep.status', '=', 'active')
    .orderBy('ep.ep_no', 'asc')
    .execute()

  const jobs = episodes.length === 0
    ? []
    : await db
      .selectFrom('tts_jobs')
      .select(['ep_id', 'source_hash', 'voice_slot', 'voice_assignment_hash', 'status', 'audio_url'])
      .where('ep_id', 'in', episodes.map((episode) => episode.ep_id))
      .execute()

  const proAssignmentHash = work.tier === 'pro'
    ? getProVoiceAssignmentHash(await getProVoiceAssignments(db, work.p_id))
    : null
  const episodeRows = episodes.map((episode) => {
    const sourceHash = episode.ep_content?.length ? getTtsSourceHash(episode.ep_content) : null
    const currentJobs = sourceHash === null ? [] : jobs.filter((job) => job.ep_id === episode.ep_id
      && job.source_hash === sourceHash
      && (work.tier !== 'pro' || (job.voice_slot === TTS_PRO_VOICE_SLOT && job.voice_assignment_hash === proAssignmentHash)))
    const completeSlots = new Set(currentJobs.filter((job) => job.status === 'done' && Boolean(job.audio_url)).map((job) => job.voice_slot))
    const hasAudio = work.tier === 'pro'
      ? completeSlots.has(TTS_PRO_VOICE_SLOT)
      : TTS_VOICE_SLOTS.every((voice) => completeSlots.has(voice.id))
    const hasActiveJob = currentJobs.some((job) => job.status === 'pending' || job.status === 'processing')
    const hasFailure = currentJobs.some((job) => job.status === 'failed')
    const audioStatus = !work.tier
      ? 'not_enabled'
      : sourceHash === null
        ? 'empty'
        : hasAudio
          ? 'ready'
          : hasActiveJob
            ? 'processing'
            : completeSlots.size > 0
              ? 'partial'
              : hasFailure
                ? 'failed'
                : 'not_generated'

    return {
      id: String(episode.ep_id),
      no: episode.ep_no,
      name: episode.ep_name,
      publish_status: episode.publish_status,
      updated_at: episode.updated_at,
      audio_status: audioStatus,
      completed_voice_count: completeSlots.size,
      required_voice_count: work.tier === 'pro' ? 1 : 3,
      can_edit: Boolean(work.tier) && sourceHash !== null,
    }
  })

  return {
    work: { uuid: work.uuid, title: work.title, tier: work.tier },
    total_episodes: episodeRows.length,
    generated_episodes: episodeRows.filter((episode) => episode.audio_status === 'ready').length,
    episodes: episodeRows,
  }
}

export async function searchTtsEditorEpisodes(userId: bigint, workUuid: string, rawQuery: string) {
  const query = rawQuery.trim()
  if (query.length < 1 || query.length > 100) throw new Error('TTS_EDITOR_SEARCH_REQUIRED')
  const like = `%${query.replace(/[\\%_]/g, '\\$&')}%`
  const numericEpisode = /^\d+$/.test(query) ? Number(query) : null
  const rows = await db
    .selectFrom('work_ep as ep')
    .innerJoin('works as work', 'work.p_id', 'ep.p_id')
    .innerJoin('tts_work_access as access', 'access.p_id', 'work.p_id')
    .select(['ep.ep_id', 'ep.ep_no', 'ep.ep_name', 'work.uuid as work_uuid', 'work.title as work_title', 'access.tier'])
    .where('work.author_id', '=', userId)
    .where('work.uuid', '=', workUuid)
    .where('work.status', '=', 'active')
    .where('work.type', '=', 'novel')
    .where('ep.status', '=', 'active')
    .where((eb) => numericEpisode === null
      ? eb('ep.ep_name', 'ilike', like)
      : eb.or([eb('ep.ep_no', '=', numericEpisode), eb('ep.ep_name', 'ilike', like)]))
    .orderBy('ep.ep_no', 'asc')
    .limit(30)
    .execute()
  return rows.map((row) => ({ ...row, ep_id: String(row.ep_id) }))
}

export async function getTtsEditorEpisode(userId: bigint, workUuid: string, epId: bigint) {
  const episode = await getOwnedEditorEpisode(userId, workUuid, epId)
  const [characterLabels, saves] = await Promise.all([
    listVoiceSlots(episode.p_id),
    db
      .selectFrom('tts_episode_edit_saves')
      .select(['id', 'slot_no', 'name', 'payload', 'created_at', 'updated_at'])
      .where('ep_id', '=', epId)
      .where('author_id', '=', userId)
      .orderBy('slot_no', 'asc')
      .execute(),
  ])
  return {
    episode: {
      id: String(episode.ep_id),
      no: episode.ep_no,
      name: episode.ep_name,
      updated_at: episode.updated_at,
      work: { uuid: episode.work_uuid, title: episode.work_title, tier: episode.tier },
      blocks: (episode.ep_content ?? []).map(normalizeStoredNovelBlock),
    },
    character_labels: characterLabels.map((label) => ({ ...label, id: label.id === null ? null : String(label.id) })),
    saves: saves.map((save) => ({ ...save, id: String(save.id) })),
    core_commands: TTS_EDITOR_CORE_COMMANDS,
  }
}

export async function saveTtsEditorEpisode(userId: bigint, workUuid: string, epId: bigint, input: { blocks: TtsEditorBlockInput[]; labels?: TtsEditorVoiceSlotInput[] }) {
  if (input.blocks.length === 0 || input.blocks.length > MAX_BLOCKS) throw new Error('TTS_EDITOR_INVALID_BLOCK_COUNT')
  if (input.labels !== undefined) validateVoiceSlots(input.labels)
  const episode = await getOwnedEditorEpisode(userId, workUuid, epId)
  const existingSlots = await listVoiceSlots(episode.p_id)
  const incomingSlots = input.labels ?? existingSlots.map((slot) => ({
    slot_no: slot.slot_no,
    shortcuts: slot.shortcuts,
    voice_category: slot.voice_category,
  }))
  const normalizedSlots: StoredVoiceSlot[] = incomingSlots.map((slot) => {
    const existing = existingSlots.find((item) => item.slot_no === slot.slot_no) ?? emptyVoiceSlot(slot.slot_no)
    return {
      ...existing,
      slot_no: slot.slot_no,
      shortcuts: slot.shortcuts.map(cleanShortcut).filter(Boolean),
      voice_category: slot.voice_category?.trim() || undefined,
    }
  })
  const blocks = input.blocks.map((block, index) => normalizeBlock(block, normalizedSlots, index))
  if (new Set(blocks.map((block) => block.id)).size !== blocks.length) throw new Error('TTS_EDITOR_DUPLICATE_BLOCK_ID')

  const previousBlocks = episode.ep_content ?? []
  const sourceChanged = getTtsSourceHash(previousBlocks) !== getTtsSourceHash(blocks)
  const blocksToStore = sourceChanged ? clearAudioTimestamps(blocks) : preserveAudioTimestamps(previousBlocks, blocks)

  await db.transaction().execute(async (trx) => {
    await trx.updateTable('work_ep')
      .set({ ep_content: JSON.stringify(blocksToStore) as unknown as NovelBlock[], updated_at: new Date(), updated_by: userId })
      .where('ep_id', '=', epId)
      .execute()
    if (input.labels === undefined) return

    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${episode.p_id.toString()}, 0))`.execute(trx)
    const resolved: StoredVoiceSlot[] = []
    const nextIndexByCategory = new Map<string, number>()
    for (const slot of normalizedSlots) {
      const parsed = parseVoiceCategoryInput(slot.voice_category ?? '')
      if (!parsed) {
        resolved.push({ ...slot, voice_category: undefined, voice_index: null, voice_shared: false })
        continue
      }
      const carried = existingSlots.find((item) => item.slot_no === slot.slot_no && item.voice_category === parsed.category)
      if (carried?.voice_index) {
        resolved.push({ ...slot, voice_category: parsed.category, voice_index: carried.voice_index, voice_shared: carried.voice_shared })
        continue
      }
      if (parsed.explicitIndex !== null) {
        resolved.push({ ...slot, voice_category: parsed.category, voice_index: parsed.explicitIndex, voice_shared: parsed.shared })
        continue
      }
      if (!nextIndexByCategory.has(parsed.category)) {
        const row = await trx.selectFrom('tts_work_character_labels')
          .select(({ fn }) => fn.max('voice_index').as('max_index'))
          .where('p_id', '=', episode.p_id)
          .where('voice_category', '=', parsed.category)
          .executeTakeFirst()
        nextIndexByCategory.set(parsed.category, (row?.max_index ?? 0) + 1)
      }
      const voiceIndex = nextIndexByCategory.get(parsed.category)!
      nextIndexByCategory.set(parsed.category, voiceIndex + 1)
      resolved.push({ ...slot, voice_category: parsed.category, voice_index: voiceIndex, voice_shared: false })
    }

    await trx.deleteFrom('tts_work_character_labels').where('p_id', '=', episode.p_id).execute()
    const toPersist = resolved.filter((slot) => slot.slot_no === 0 || slot.shortcuts.length > 0 || Boolean(slot.voice_category))
    if (toPersist.length === 0) return
    const inserted = await trx.insertInto('tts_work_character_labels').values(toPersist.map((slot) => ({
      p_id: episode.p_id,
      slot_no: slot.slot_no,
      shortcut: null,
      display_name: slot.slot_no === 0 ? 'Narrator' : `ช่องเสียง ${slot.slot_no}`,
      voice_role: slot.slot_no === 0 ? 'lead' : 'supporting',
      gender: 'female',
      color: slot.slot_no === 0 ? '#f97316' : '#7c3aed',
      voice_category: slot.voice_category ?? null,
      voice_index: slot.voice_index,
      voice_shared: slot.voice_shared,
    }))).returning(['id', 'slot_no']).execute()
    const labelIdBySlot = new Map(inserted.map((label) => [label.slot_no, label.id]))
    const aliases = toPersist.flatMap((slot) => slot.shortcuts.map((shortcut) => ({
      p_id: episode.p_id,
      label_id: labelIdBySlot.get(slot.slot_no)!,
      shortcut,
    })))
    if (aliases.length > 0) await trx.insertInto('tts_work_character_shortcuts').values(aliases).execute()
  })

  if (sourceChanged) await invalidateTtsForEpisode(epId)
  if (input.labels !== undefined) await invalidateProTtsForWork(episode.p_id)
  return { blocks: blocksToStore, changed_at: new Date() }
}

export async function saveTtsEditorDraft(userId: bigint, workUuid: string, epId: bigint, slotNo: number, name: string, payload: unknown) {
  if (![1, 2].includes(slotNo)) throw new Error('TTS_EDITOR_INVALID_SAVE_SLOT')
  await getOwnedEditorEpisode(userId, workUuid, epId)
  const serialized = JSON.stringify(payload)
  if (serialized.length > MAX_DRAFT_BYTES) throw new Error('TTS_EDITOR_SAVE_TOO_LARGE')
  const draft = await db
    .insertInto('tts_episode_edit_saves')
    .values({ ep_id: epId, author_id: userId, slot_no: slotNo, name: name.trim().slice(0, 80), payload: serialized })
    .onConflict((oc) => oc.columns(['ep_id', 'slot_no']).doUpdateSet({ name: name.trim().slice(0, 80), payload: serialized, updated_at: new Date() }))
    .returning(['id', 'slot_no', 'name', 'payload', 'created_at', 'updated_at'])
    .executeTakeFirstOrThrow()
  return { ...draft, id: String(draft.id) }
}

export async function deleteTtsEditorDraft(userId: bigint, workUuid: string, epId: bigint, slotNo: number) {
  if (![1, 2].includes(slotNo)) throw new Error('TTS_EDITOR_INVALID_SAVE_SLOT')
  await getOwnedEditorEpisode(userId, workUuid, epId)
  await db.deleteFrom('tts_episode_edit_saves').where('ep_id', '=', epId).where('author_id', '=', userId).where('slot_no', '=', slotNo).execute()
}

export async function queueTtsEditorEpisode(userId: bigint, workUuid: string, epId: bigint, voiceSlots?: TtsVoiceSlot[]) {
  await getOwnedEditorEpisode(userId, workUuid, epId)
  return queueWriterTtsEdit(userId, epId, voiceSlots)
}
