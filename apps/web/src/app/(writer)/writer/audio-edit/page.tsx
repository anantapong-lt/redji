'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Command, CopyPlus, Loader2, Plus, Save, Sparkles, Split, Trash2, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'

type BlockTts = { block_kind?: 'narration' | 'gap'; gap_seconds?: number; skip?: boolean; speaker_slot?: number; emotion?: 'neutral' | 'sad' | 'angry' | 'happy' | 'excited' | 'fear' }
type EditorBlock = { id: string; display_label: string; text: string; style: Record<string, unknown> | null; audio_ts: { start: number; end: number } | null; tts_text?: string; tts?: BlockTts; _forceRegen?: boolean }
type VoiceSlot = { id?: string | null; slot_no: number; shortcuts: string[]; voice_category: string; voice_index?: number | null; voice_shared?: boolean }
type SaveSlot = { id: string; slot_no: number; name: string; payload: unknown; updated_at: string }
type AudioStatus = 'ready' | 'processing' | 'partial' | 'failed' | 'not_generated' | 'not_enabled' | 'empty'
type WorkEpisode = { id: string; no: number; name: string; publish_status: string; updated_at: string; audio_status: AudioStatus; completed_voice_count: number; required_voice_count: number; can_edit: boolean }
type WorkAudioOverview = {
  work: { uuid: string; title: string; tier: 'basic' | 'pro' | null }
  total_episodes: number
  generated_episodes: number
  episodes: WorkEpisode[]
}
type EditorData = {
  episode: { id: string; no: number; name: string; updated_at: string; work: { uuid: string; title: string; tier: 'basic' | 'pro' }; blocks: EditorBlock[] }
  character_labels: VoiceSlot[]
  saves: SaveSlot[]
  core_commands: { shortcut: string; label: string; description: string; supported: boolean }[]
}

type BasicVoiceSlot = 'old_male' | 'young_male' | 'female'
const BASIC_VOICE_SLOTS: BasicVoiceSlot[] = ['old_male', 'young_male', 'female']
const BASIC_VOICE_SLOT_LABEL: Record<BasicVoiceSlot, string> = { old_male: 'ชายแก่', young_male: 'หนุ่มน้อย', female: 'คุณผู้หญิง' }
const AUDIO_STATUS: Record<AudioStatus, { label: string; className: string }> = {
  ready: { label: 'มีเสียงครบ', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  processing: { label: 'กำลังสร้าง', className: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' },
  partial: { label: 'เสียงยังไม่ครบ', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' },
  failed: { label: 'สร้างไม่สำเร็จ', className: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
  not_generated: { label: 'ยังไม่สร้าง', className: 'bg-muted text-muted-foreground' },
  not_enabled: { label: 'ยังไม่เปิดใช้ TTS', className: 'bg-muted text-muted-foreground' },
  empty: { label: 'ไม่มีข้อความ', className: 'bg-muted text-muted-foreground' },
}

function blankVoiceSlots(): VoiceSlot[] {
  return Array.from({ length: 7 }, (_, slot_no) => ({
    slot_no,
    shortcuts: [],
    voice_category: '',
  }))
}

function editorText(block: EditorBlock) {
  return block.tts_text ?? block.text
}

// ตัวละครยังอ่านจาก //shortcut ที่พิมพ์ในข้อความเหมือนเดิม (ไม่ใช้ dropdown ตายตัว
// เพราะรายชื่อเสียงที่แอดมินเพิ่มใหม่อยู่ใน Google Sheet ไม่ได้ผูกกับ DB) ช่องนี้แค่
// เป็นทางลัดอ่าน/เขียน //shortcut ตัวแรกในข้อความ ไม่ใช่ field แยกต่างหาก
function extractSpeakerShortcut(text: string) {
  const match = text.match(/\/\/([\p{L}][\p{L}\p{N}_-]{0,30})/u)
  return match ? match[1] : ''
}

function applySpeakerShortcut(text: string, shortcut: string) {
  const stripped = text.replace(/\/\/[\p{L}][\p{L}\p{N}_-]{0,30}/gu, '').replace(/\s{2,}/g, ' ').trim()
  const clean = shortcut.trim().replace(/^\/\//, '')
  return clean ? `//${clean} ${stripped}` : stripped
}

function cloneBlocks(blocks: EditorBlock[]) {
  return blocks.map((block) => ({ ...block, tts: block.tts ? { ...block.tts } : undefined, style: block.style ? { ...block.style } : null }))
}

function buildPayload(blocks: EditorBlock[], labels: VoiceSlot[]) {
  return {
    blocks: blocks.map((block) => ({
      id: block.id,
      display_label: block.display_label,
      text: editorText(block),
      style: block.style,
      block_kind: block.tts?.block_kind ?? 'narration',
      gap_seconds: block.tts?.gap_seconds,
      emotion: block.tts?.emotion,
    })),
    labels: labels.map(({ id: _id, voice_index: _index, voice_shared: _shared, ...label }) => ({
      ...label,
      shortcuts: label.shortcuts.map((shortcut) => shortcut.trim().replace(/^\/\//, '')).filter(Boolean),
      voice_category: label.voice_category.trim(),
    })),
  }
}

export function WorkAudioEditor({ workUuid }: { workUuid: string }) {
  const queryClient = useQueryClient()
  const [episodeId, setEpisodeId] = useState<string | null>(null)
  const [blocks, setBlocks] = useState<EditorBlock[]>([])
  const [labels, setLabels] = useState<VoiceSlot[]>(blankVoiceSlots)
  const [baseline, setBaseline] = useState<{ blocks: EditorBlock[]; labels: VoiceSlot[] } | null>(null)
  const [savedSinceLoad, setSavedSinceLoad] = useState(false)
  const [activePanel, setActivePanel] = useState<'characters' | 'commands' | 'drafts' | null>(null)
  const [selectedVoices, setSelectedVoices] = useState<Record<BasicVoiceSlot, boolean>>({ old_male: true, young_male: true, female: true })
  const selection = useRef<{ row: number; start: number; end: number } | null>(null)

  const overview = useQuery({
    queryKey: ['writer', 'tts-editor', 'work', workUuid, 'overview'],
    queryFn: () => api.get<{ data: WorkAudioOverview }>(`/writer/tts-editor/works/${workUuid}`).then((result) => result.data),
  })
  const editor = useQuery({
    queryKey: ['writer', 'tts-editor', 'work', workUuid, 'episode', episodeId],
    queryFn: () => api.get<{ data: EditorData }>(`/writer/tts-editor/works/${workUuid}/episodes/${episodeId}`).then((result) => result.data),
    enabled: episodeId !== null,
  })
  // Basic ใช้เสียงบรรยายเดียวบังคับเสมอ ใส่ตัวละครไปก็ไม่มีผลอะไร — เปิดปุ่มให้กดได้เฉพาะ Pro
  const isPro = editor.data?.episode.work.tier === 'pro'

  useEffect(() => {
    if (!editor.data) return
    const nextBlocks = cloneBlocks(editor.data.episode.blocks)
    const nextLabels = blankVoiceSlots().map((fallback) => ({ ...fallback, ...(editor.data!.character_labels.find((item) => item.slot_no === fallback.slot_no) ?? {}) }))
    setBlocks(nextBlocks)
    setLabels(nextLabels)
    setBaseline({ blocks: cloneBlocks(nextBlocks), labels: nextLabels.map((label) => ({ ...label })) })
    setSavedSinceLoad(false)
    setSelectedVoices({ old_male: true, young_male: true, female: true })
    selection.current = null
  }, [editor.data])

  const changeCount = useMemo(() => {
    if (!baseline) return 0
    const before = buildPayload(baseline.blocks, baseline.labels)
    const after = buildPayload(blocks, labels)
    return after.blocks.reduce((total, block, index) => total + (JSON.stringify(block) === JSON.stringify(before.blocks[index]) ? 0 : 1), 0)
      + Math.abs(after.blocks.length - before.blocks.length)
      + (JSON.stringify(after.labels) === JSON.stringify(before.labels) ? 0 : 1)
  }, [baseline, blocks, labels])

  // ต่อ block ว่าเนื้อหาต่างจาก baseline ไหม (payload เดียวกับ changeCount ข้างบน
  // ไม่รวม audio_ts ที่เป็นแค่ readonly display) — ใช้ auto-tick checkbox "เจนใหม่"
  const changedFlags = useMemo(() => {
    if (!baseline) return blocks.map(() => false)
    const before = buildPayload(baseline.blocks, baseline.labels).blocks
    const after = buildPayload(blocks, labels).blocks
    return after.map((block, index) => JSON.stringify(block) !== JSON.stringify(before[index]))
  }, [baseline, blocks, labels])

  // ระบบ worker ปัจจุบันยัง Gen ใหม่ทั้งตอนเสมอ แต่การติ๊กไว้สัก Chunk คือความตั้งใจ
  // ชัดเจนของผู้เขียนว่าอยากสั่ง Gen แม้ source จะไม่ได้เปลี่ยน จึงอนุญาตให้ส่งเข้าคิว
  // ได้โดยไม่ต้องแก้ข้อความหรือกดบันทึกก่อน (รองรับ repair-one-chunk ในอนาคตด้วย)
  const hasForcedRegen = useMemo(() => blocks.some((block) => Boolean(block._forceRegen)), [blocks])

  function updateBlock(index: number, patch: Partial<EditorBlock>) {
    setBlocks((current) => current.map((block, row) => row === index ? { ...block, ...patch } : block))
    setSavedSinceLoad(false)
  }

  // ติ๊กเอง (บังคับเจนใหม่ทั้งที่ข้อความเดิม) — ไม่ผ่าน updateBlock เพราะไม่ใช่การแก้
  // เนื้อหาที่ต้องกด "บันทึก" ก่อน แค่เป็นสัญญาณว่าอยากให้ block นี้เจนใหม่ด้วย
  function toggleForceRegen(index: number, checked: boolean) {
    setBlocks((current) => current.map((block, row) => row === index ? { ...block, _forceRegen: checked } : block))
  }

  function addGap(afterIndex = blocks.length - 1) {
    const gap: EditorBlock = { id: '', display_label: 'gap', text: '', style: null, audio_ts: null, tts: { block_kind: 'gap', gap_seconds: 1 } }
    setBlocks((current) => [...current.slice(0, afterIndex + 1), gap, ...current.slice(afterIndex + 1)])
    setSavedSinceLoad(false)
  }

  function removeBlock(index: number) {
    if (blocks.length <= 1) return toast.error('ต้องมีอย่างน้อยหนึ่ง Chunk')
    setBlocks((current) => current.filter((_, row) => row !== index))
    setSavedSinceLoad(false)
  }

  function splitBlock(index: number) {
    const active = selection.current
    const raw = editorText(blocks[index])
    if (!active || active.row !== index || active.start <= 0 || active.start >= raw.length) {
      toast.error('เลือกตำแหน่งในข้อความก่อน แล้วจึงกดแบ่ง Chunk')
      return
    }
    const left = raw.slice(0, active.start).trim()
    const right = raw.slice(active.end || active.start).trim()
    if (!left || !right) return toast.error('ตำแหน่งแบ่งต้องมีข้อความทั้งสองด้าน')
    const current = blocks[index]
    const first: EditorBlock = { ...current, id: '', text: left, tts_text: left, audio_ts: null }
    const second: EditorBlock = { ...current, id: '', text: right, tts_text: right, audio_ts: null }
    setBlocks((items) => [...items.slice(0, index), first, second, ...items.slice(index + 1)])
    setSavedSinceLoad(false)
  }

  async function saveEditor() {
    if (!episodeId) return
    try {
      const result = await api.put<{ data: { blocks: EditorBlock[] } }>(`/writer/tts-editor/works/${workUuid}/episodes/${episodeId}`, buildPayload(blocks, labels))
      const nextBlocks = cloneBlocks(result.data.blocks)
      setBlocks(nextBlocks)
      setBaseline({ blocks: cloneBlocks(nextBlocks), labels: labels.map((label) => ({ ...label })) })
      setSavedSinceLoad(true)
      await queryClient.invalidateQueries({ queryKey: ['writer', 'tts-editor', 'work', workUuid, 'overview'] })
      toast.success('บันทึก Chunk แล้ว — เสียงเดิมถูกพักไว้จนกว่าจะสั่ง Gen ใหม่')
    } catch (error: any) {
      toast.error(error?.message ?? 'บันทึกการแก้ไขเสียงไม่สำเร็จ')
    }
  }

  async function queueEdit() {
    if (!episodeId || (!savedSinceLoad && !hasForcedRegen) || changeCount > 0) return
    const voice_slots = isPro ? ['pro'] : BASIC_VOICE_SLOTS.filter((slot) => selectedVoices[slot])
    if (voice_slots.length === 0) return toast.error('เลือกอย่างน้อยหนึ่งเสียงก่อนดำเนินการแก้ไข')
    try {
      await api.post(`/writer/tts-editor/works/${workUuid}/episodes/${episodeId}/queue`, { voice_slots })
      toast.success('ส่งงานแก้ไขเข้าคิวแล้ว ระบบจะ Gen ทั้งตอนใหม่เพื่อให้เวลาเสียงตรงกับ Chunk')
      await queryClient.invalidateQueries({ queryKey: ['writer', 'tts-editor', 'work', workUuid, 'episode', episodeId] })
      await queryClient.invalidateQueries({ queryKey: ['writer', 'tts-editor', 'work', workUuid, 'overview'] })
    } catch (error: any) {
      toast.error(error?.message ?? 'ส่งงานแก้ไขเข้าคิวไม่สำเร็จ')
    }
  }

  async function saveDraft(slot: 1 | 2) {
    if (!episodeId) return
    const existing = editor.data?.saves.find((save) => save.slot_no === slot)
    if (existing && !window.confirm(`เขียนทับบันทึกช่อง ${slot} หรือไม่?`)) return
    const name = window.prompt('ชื่อบันทึกย่อ', existing?.name || `ฉบับร่าง ${slot}`)
    if (name === null) return
    try {
      await api.put(`/writer/tts-editor/works/${workUuid}/episodes/${episodeId}/saves/${slot}`, { name, payload: { blocks, labels } })
      toast.success(`เก็บฉบับร่างช่อง ${slot} แล้ว`)
      await queryClient.invalidateQueries({ queryKey: ['writer', 'tts-editor', 'work', workUuid, 'episode', episodeId] })
    } catch (error: any) {
      toast.error(error?.message ?? 'บันทึกฉบับร่างไม่สำเร็จ')
    }
  }

  function restoreDraft(slot: 1 | 2) {
    const draft = editor.data?.saves.find((save) => save.slot_no === slot)
    const payload = draft?.payload as { blocks?: EditorBlock[]; labels?: VoiceSlot[] } | undefined
    if (!payload?.blocks || !window.confirm(`เรียกคืน “${draft?.name || `ช่อง ${slot}`}” และแทนที่การแก้ไขบนจอนี้หรือไม่?`)) return
    setBlocks(cloneBlocks(payload.blocks))
    setLabels(payload.labels?.map((label) => ({ ...label })) ?? blankVoiceSlots())
    setSavedSinceLoad(false)
    toast.message('เรียกคืนฉบับร่างแล้ว — กดบันทึกเมื่อต้องการใช้จริง')
  }

  async function deleteDraft(slot: 1 | 2) {
    if (!episodeId || !window.confirm(`ลบบันทึกช่อง ${slot} หรือไม่?`)) return
    await api.delete(`/writer/tts-editor/works/${workUuid}/episodes/${episodeId}/saves/${slot}`)
    await queryClient.invalidateQueries({ queryKey: ['writer', 'tts-editor', 'work', workUuid, 'episode', episodeId] })
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] text-primary">TTS EDITOR</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-[-0.025em] text-foreground"><Volume2 className="size-6 text-primary" />แก้ไขเสียง</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">แก้ข้อความและจังหวะเป็น Chunk ได้โดยตรง การบันทึกจะอัปเดตข้อความที่ผู้อ่านเห็นด้วย ส่วนคำสั่ง TTS จะไม่แสดงในหน้านิยาย</p>
        </div>
        {editor.data && <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-sm"><p className="font-semibold">{editor.data.episode.work.title}</p><p className="mt-0.5 text-xs text-muted-foreground">ตอน {editor.data.episode.no}: {editor.data.episode.name} · {editor.data.episode.work.tier.toUpperCase()}</p></div>}
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_45px_-38px_rgb(45_29_32_/_0.65)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-bold">ตอนในเรื่องนี้</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">เลือกตอนเพื่อเปิดตาราง Chunk และแก้ไขเสียง</p>
          </div>
          {overview.data && <div className="flex flex-wrap gap-2 text-xs font-medium"><span className="rounded-full bg-muted px-3 py-1.5">ทั้งหมด {overview.data.total_episodes} ตอน</span><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">มีเสียงแล้ว {overview.data.generated_episodes} ตอน</span></div>}
        </div>

        {overview.isLoading ? <div className="flex min-h-44 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />กำลังโหลดรายตอน…</div> : overview.isError ? <p className="p-6 text-sm text-destructive">โหลดรายตอนสำหรับแก้ไขเสียงไม่สำเร็จ ลองรีเฟรชอีกครั้ง</p> : overview.data && <>
          {!overview.data.work.tier && <p className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">เรื่องนี้ยังไม่ได้รับสิทธิ์ TTS จึงดูรายการตอนได้ แต่จะเปิดตารางแก้ไขไม่ได้จนกว่าจะอนุมัติการใช้ TTS</p>}
          {overview.data.episodes.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">เรื่องนี้ยังไม่มีตอน</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-muted/45 text-left text-xs text-muted-foreground"><tr><th className="w-20 px-5 py-3">ตอน</th><th className="px-4 py-3">ชื่อตอน</th><th className="w-36 px-4 py-3">สถานะเสียง</th><th className="w-28 px-4 py-3 text-center">เสียงที่พร้อม</th><th className="w-32 px-5 py-3 text-right">จัดการ</th></tr></thead><tbody>{overview.data.episodes.map((episode) => { const status = AUDIO_STATUS[episode.audio_status]; const selected = episode.id === episodeId; return <tr key={episode.id} className={`border-t border-border/75 transition-colors ${selected ? 'bg-primary/5' : 'hover:bg-muted/25'}`}><td className="px-5 py-3 font-medium">{episode.no}</td><td className="px-4 py-3"><p className="font-medium">{episode.name || `ตอนที่ ${episode.no}`}</p><p className="mt-0.5 text-xs text-muted-foreground">{episode.publish_status === 'now' ? 'เผยแพร่แล้ว' : 'ยังไม่เผยแพร่'}</p></td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span></td><td className="px-4 py-3 text-center text-xs text-muted-foreground">{episode.can_edit ? `${episode.completed_voice_count}/${episode.required_voice_count} เสียง` : '—'}</td><td className="px-5 py-3 text-right"><Button type="button" size="sm" variant={selected ? 'default' : 'outline'} disabled={!episode.can_edit} onClick={() => setEpisodeId(selected ? null : episode.id)}>{selected ? 'ปิดตาราง' : episode.can_edit ? 'แก้ไข Chunk' : 'ยังแก้ไม่ได้'}</Button></td></tr> })}</tbody></table></div>}
        </>}
      </section>

      {editor.isLoading && <div className="py-16 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-3 size-5 animate-spin" />กำลังเปิดตารางเสียง…</div>}
      {editor.isError && <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">เปิดตาราง Chunk ไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</div>}
      {editor.data && <>
        <div className="mt-6">
          <div className="mb-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setActivePanel('characters')} title={isPro ? undefined : 'บันทึก mapping ล่วงหน้าได้ แต่ Basic ยังอ่านด้วย narrator เดียว'}><Sparkles data-icon="inline-start" />ตัวละครและคำสั่งลัด</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setActivePanel('commands')}><Command data-icon="inline-start" />คำสั่งระบบ</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setActivePanel('drafts')}><Save data-icon="inline-start" />บันทึกฉบับร่าง</Button>
          </div>
          <section className="min-w-0 rounded-2xl border border-border bg-card shadow-[0_16px_42px_-38px_rgb(45_29_32_/_0.75)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><h2 className="font-bold">ตาราง Chunk</h2><p className="mt-0.5 text-xs text-muted-foreground">เลือกตำแหน่งในข้อความ แล้วกด “แบ่ง” เพื่อแยก Chunk เฉพาะช่วง</p></div><Button type="button" size="sm" variant="outline" onClick={() => addGap()}><Plus data-icon="inline-start" />เพิ่มช่วงว่าง</Button></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="w-10 px-2 py-3 text-center" title="ติ๊กเพื่อบังคับเจนเสียงใหม่ — ข้อความที่แก้จะติ๊กให้อัตโนมัติ">เจน</th><th className="w-12 px-3 py-3 text-center">#</th><th className="w-[48%] px-3 py-3">ข้อความ / คำสั่ง</th><th className="w-32 px-3 py-3" title="อ่าน/เขียนจาก //shortcut ตัวแรกในข้อความ พิมพ์ตามที่ตกลงกันไว้ใน Google Sheet รายชื่อเสียง">ตัวละคร</th><th className="w-28 px-3 py-3">เวลาเดิม</th><th className="w-40 px-3 py-3 text-right">เครื่องมือ</th></tr></thead><tbody>{blocks.map((block, index) => {
              const isGap = block.tts?.block_kind === 'gap'
              const willRegen = changedFlags[index] || Boolean(block._forceRegen)
              return <tr key={`${block.id || 'new'}-${index}`} className={`border-t border-border/75 align-top ${willRegen ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}><td className="px-2 py-4 text-center"><input type="checkbox" checked={willRegen} disabled={changedFlags[index]} onChange={(event) => toggleForceRegen(index, event.target.checked)} title={changedFlags[index] ? 'ข้อความถูกแก้ไข จะเจนเสียงใหม่อัตโนมัติ' : 'ติ๊กเพื่อบังคับเจนเสียงใหม่ด้วยข้อความเดิม'} className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed" /></td><td className="px-3 py-4 text-center font-mono text-xs text-muted-foreground">{index + 1}</td><td className="px-3 py-3">{isGap ? <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/70 p-2 dark:border-sky-900 dark:bg-sky-950/20"><span className="text-xs font-semibold text-sky-700 dark:text-sky-300">ช่วงว่าง</span><input type="number" min="0.1" max="15" step="0.1" value={block.tts?.gap_seconds ?? 1} onChange={(event) => updateBlock(index, { tts: { block_kind: 'gap', gap_seconds: Number(event.target.value) } })} className="h-8 w-20 rounded-lg border border-sky-200 bg-card px-2 text-sm" /><span className="text-xs text-muted-foreground">วินาที</span></div> : <textarea value={editorText(block)} onChange={(event) => updateBlock(index, { text: event.target.value, tts_text: event.target.value })} onSelect={(event) => { selection.current = { row: index, start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd } }} rows={Math.min(6, Math.max(2, Math.ceil(Math.max(editorText(block).length, 1) / 78)))} className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 leading-6 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25" placeholder="ข้อความสำหรับผู้อ่าน หรือพิมพ์ //1, {pause:1.5}, //hero" />}</td><td className="px-3 py-3">{!isGap && (isPro ? <input value={extractSpeakerShortcut(editorText(block))} onChange={(event) => { const nextText = applySpeakerShortcut(editorText(block), event.target.value); updateBlock(index, { text: nextText, tts_text: nextText }) }} placeholder="พิมพ์ alias เช่น jinnie" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs" /> : <span className="inline-flex h-9 items-center rounded-lg bg-muted px-2 text-xs text-muted-foreground">Narrator (Basic)</span>)}</td><td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">{block.audio_ts ? `${block.audio_ts.start.toFixed(2)}–${block.audio_ts.end.toFixed(2)}s` : 'รอ Gen'}</td><td className="px-3 py-3"><div className="flex justify-end gap-1"><Button type="button" size="icon-sm" variant="ghost" title="แบ่ง Chunk ตำแหน่งที่เลือก" onClick={() => splitBlock(index)}><Split className="size-3.5" /></Button><Button type="button" size="icon-sm" variant="ghost" title="เพิ่มช่วงว่างถัดจากบรรทัดนี้" onClick={() => addGap(index)}><CopyPlus className="size-3.5" /></Button><Button type="button" size="icon-sm" variant="ghost" title="ลบ Chunk" onClick={() => removeBlock(index)} className="text-destructive hover:text-destructive"><Trash2 className="size-3.5" /></Button></div></td></tr>
            })}</tbody></table></div>
          </section>

          <Dialog open={activePanel === 'characters'} onOpenChange={(next) => setActivePanel(next ? 'characters' : null)}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" />ตัวละครและคำสั่งลัด</DialogTitle>
                <DialogDescription>ตัวเลข //1–//20 สงวนไว้ให้คำสั่งระบบ</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">{labels.map((label, index) => <div key={label.slot_no} className="rounded-xl border border-border bg-muted/25 p-3"><div className="mb-2 text-xs font-semibold">{label.slot_no === 0 ? 'Narrator · slot 0 (มีได้ช่องเดียว)' : `ช่องเสียง ${label.slot_no}`}</div>{label.slot_no === 0 ? <p className="text-xs text-muted-foreground">ปล่อยว่าง = Basic_female · ตั้ง <code>Basic_1</code>, <code>Basic_2</code>, <code>Basic_3</code> หรือหมวด Pro อื่นเพื่อ override</p> : <input value={label.shortcuts.join(', ')} onChange={(event) => setLabels((items) => items.map((item, row) => row === index ? { ...item, shortcuts: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) } : item))} placeholder="alias หลายชื่อ คั่นด้วย comma เช่น jinnie, lawrence" className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs" />}<input value={label.voice_category} onChange={(event) => setLabels((items) => items.map((item, row) => row === index ? { ...item, voice_category: event.target.value } : item))} placeholder={label.slot_no === 0 ? 'เสียง narrator (ว่าง = Basic_female)' : 'หมวดเสียง เช่น handsome_male, handsome_male_3!'} title="ชื่อหมวด = จองไฟล์ถัดไปอัตโนมัติ · ชื่อหมวด_เลข = ระบุไฟล์เอง · ชื่อหมวด_เลข! = ให้หลาย slot ใช้ไฟล์เดียวกันร่วมได้" className="mt-2 h-8 w-full rounded-lg border border-input bg-background px-2 text-xs" /></div>)}</div>
            </DialogContent>
          </Dialog>

          <Dialog open={activePanel === 'commands'} onOpenChange={(next) => setActivePanel(next ? 'commands' : null)}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>คำสั่งระบบ</DialogTitle></DialogHeader>
              <div className="space-y-2">{editor.data.core_commands.map((command) => <div key={command.shortcut} className="flex gap-2 text-xs"><code className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-bold text-primary">{command.shortcut}</code><span className="text-muted-foreground"><b className="text-foreground">{command.label}</b> · {command.description}</span></div>)}<div className="border-t border-border pt-2 text-xs text-muted-foreground"><code>{'{pause:2}'}</code> เว้นตามวินาที · <code>{'{skip}'}</code> ข้ามบล็อก · <code>{'{breath}'}</code> เว้นจังหวะหายใจ<br /><span className="mt-1 block">โมเดลปัจจุบันทำ “จังหวะหายใจ” เป็นช่วงเงียบ ยังไม่ได้สร้างเอฟเฟกต์ลมหายใจจริง</span></div></div>
            </DialogContent>
          </Dialog>

          <Dialog open={activePanel === 'drafts'} onOpenChange={(next) => setActivePanel(next ? 'drafts' : null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>บันทึกฉบับร่าง</DialogTitle><DialogDescription>เก็บได้ 2 ชุดต่อตอน</DialogDescription></DialogHeader>
              <div className="space-y-2">{([1, 2] as const).map((slot) => { const draft = editor.data!.saves.find((save) => save.slot_no === slot); return <div key={slot} className="rounded-xl border border-border p-2.5"><p className="truncate text-xs font-medium">ช่อง {slot}: {draft?.name || 'ว่าง'}</p><div className="mt-2 flex gap-1.5"><Button type="button" size="xs" variant="outline" onClick={() => saveDraft(slot)}><Save data-icon="inline-start" />บันทึก</Button>{draft && <><Button type="button" size="xs" variant="ghost" onClick={() => restoreDraft(slot)}>เรียกคืน</Button><Button type="button" size="xs" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteDraft(slot)}>ลบ</Button></>}</div></div> })}</div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="sticky bottom-4 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-[0_14px_35px_-22px_rgb(45_29_32_/_0.55)] backdrop-blur"><p className="px-2 text-sm text-muted-foreground">{changeCount ? `แก้ไขแล้ว ${changeCount} จุด` : hasForcedRegen ? 'เลือกบังคับเจนใหม่แล้ว' : 'ยังไม่มีการแก้ไข'}{savedSinceLoad && <span className="ml-2 text-emerald-600">บันทึกแล้ว</span>}</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => { if (baseline) { setBlocks(cloneBlocks(baseline.blocks)); setLabels(baseline.labels.map((label) => ({ ...label, shortcuts: [...label.shortcuts] }))); setSavedSinceLoad(false) } }} disabled={!baseline || !changeCount}>ยกเลิกการแก้ไข</Button><Button type="button" onClick={saveEditor} disabled={!changeCount}><Save data-icon="inline-start" />บันทึก</Button>{isPro ? <span className="inline-flex items-center rounded-full border border-violet-300 bg-violet-50 px-3 text-xs font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-200">Pro TTS · 1 งานหลายเสียง</span> : <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1" title="เลือกเสียง Basic ที่จะเจนใหม่">{BASIC_VOICE_SLOTS.map((slot) => <label key={slot} className={`flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-xs ${selectedVoices[slot] ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground'}`}><input type="checkbox" checked={selectedVoices[slot]} onChange={(event) => setSelectedVoices((current) => ({ ...current, [slot]: event.target.checked }))} className="size-3.5 accent-primary" />{BASIC_VOICE_SLOT_LABEL[slot]}</label>)}</div>}<Button type="button" onClick={queueEdit} disabled={(!savedSinceLoad && !hasForcedRegen) || changeCount > 0 || (!isPro && !BASIC_VOICE_SLOTS.some((slot) => selectedVoices[slot]))} className="bg-violet-700 hover:bg-violet-800"><Check data-icon="inline-start" />ดำเนินการแก้ไข</Button></div></div>
      </>}
    </div>
  )
}

// ไม่มีเมนูหลักสำหรับเครื่องมือนี้แล้ว ต้องเปิดจากแท็บ “แก้ไขเสียง” ในงานเขียนแต่ละเรื่อง
// เพื่อให้ขอบเขตการค้นหา/แก้ไขไม่ข้ามไปยังนิยายเรื่องอื่น
export default function WriterAudioEditPage() {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
      <Volume2 className="mx-auto size-7 text-primary" />
      <h1 className="mt-3 text-xl font-bold">แก้ไขเสียงอยู่ในหน้าจัดการนิยาย</h1>
      <p className="mt-2 text-sm text-muted-foreground">เปิดนิยายที่ต้องการ แล้วเลือกแท็บ “แก้ไขเสียง” เพื่อเลือกตอนและแก้ไข Chunk ของเรื่องนั้น</p>
    </section>
  )
}
