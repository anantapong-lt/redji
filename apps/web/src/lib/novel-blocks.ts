import type { JSONContent } from '@tiptap/react'
import type { NovelBlock } from '@/types'

// แปลง Tiptap JSON (จาก RichTextEditor) เป็น NovelBlock[] ตามที่ backend ต้องการจริง
// (ตัดสไตล์ inline ทิ้งไปก่อน — NovelBlock.style เป็น per-block เท่านั้น ไม่รองรับ bold/italic
// แบบผสมในย่อหน้าเดียว ดู KNOWN_ISSUES.md)
export function tiptapToNovelBlocks(doc: JSONContent | undefined): NovelBlock[] {
  if (!doc?.content) return []
  const blocks: NovelBlock[] = []
  let i = 0
  for (const node of doc.content) {
    if (node.type !== 'paragraph') continue
    const text = (node.content ?? []).map((c) => c.text ?? '').join('').trim()
    if (!text) continue
    i++
    const isDialogue = /^["“”]/.test(text)
    blocks.push({ id: `block_${i}`, display_label: isDialogue ? 'dialogue' : 'paragraph', text, style: null, audio_ts: null })
  }
  return blocks
}

// ของเก่าใน DB ที่ยังไม่เคย resave ตั้งแต่ 2026-08-16 จะยังมี key เดิม (label/tts.kind) ไม่มี
// display_label/tts.block_kind เลย — normalize ตอนอ่านให้จุดแสดงผล (เช่น episode-content-reader.tsx)
// เห็นค่าที่ถูกต้องเสมอ โดยไม่ต้องรอ backfill migration ทั้งฐานข้อมูล (ดู Tier1_DesignCore.md)
export function normalizeStoredNovelBlock(raw: NovelBlock): NovelBlock {
  const legacy = raw as NovelBlock & { label?: string }
  const display_label = raw.display_label ?? legacy.label ?? 'paragraph'
  if (!raw.tts) return { ...raw, display_label }
  const legacyTts = raw.tts as NonNullable<NovelBlock['tts']> & { kind?: 'narration' | 'gap' }
  return { ...raw, display_label, tts: { ...raw.tts, block_kind: raw.tts.block_kind ?? legacyTts.kind } }
}

// ทางกลับ — ใช้ตอนเปิดหน้าต่างแก้ไขตอน เพื่อโหลดเนื้อหาเดิมกลับเข้า RichTextEditor
// (ได้แค่ plain text ต่อย่อหน้า เพราะ formatting inline ไม่ได้เก็บไว้ตั้งแต่แรก)
export function novelBlocksToTiptap(blocks: NovelBlock[] | null | undefined): JSONContent | undefined {
  if (!blocks || blocks.length === 0) return undefined
  return {
    type: 'doc',
    content: blocks.map((b) => ({
      type: 'paragraph',
      content: b.text ? [{ type: 'text', text: b.text }] : undefined,
    })),
  }
}
