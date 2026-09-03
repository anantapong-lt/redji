// =============================================================
// Novel Platform — Writer Bulk Episode Upload Service
// วางไว้ที่: apps/api/src/modules/writer/writer.bulk-upload.service.ts
// =============================================================
//
// ฟีเจอร์ "เพิ่มอัตโนมัติ" — อัปโหลด zip ที่มีไฟล์ตอนหลายไฟล์พร้อมกัน ระบบแตกไฟล์
// + หั่นเนื้อหาแต่ละไฟล์เป็นตอนให้อัตโนมัติ (reuse autoChunkText() ที่มีอยู่แล้ว)
//
// Design (ตัดสินใจร่วมกับ user 2026-07-18):
//   - รับเฉพาะ .txt / .docx ในไฟล์ zip (ไม่รับ .doc ไบนารีเก่า)
//   - ชื่อไฟล์ 2 แบบ: "N.ext" (ไม่มีชื่อตอน ใช้ fallback "ตอนที่ N") หรือ
//     "N_ชื่อตอน.ext" (ตัดเลขลำดับหน้า _ ออกมาเรียง ส่วนหลังใช้เป็นชื่อตอนจริง)
//   - เลขไฟล์ใช้แค่ "จัดลำดับ" การประมวลผล ไม่ใช่ ep_no ตรงๆ — ep_no จริงต่อจากเลข
//     ตอนสูงสุดเดิมของเรื่อง (กันชนกับตอนที่มีอยู่แล้ว)
//   - ไฟล์ไหนพัง/เปิดไม่ได้ ข้ามไฟล์นั้นไป ไม่ทำให้ batch ทั้งก้อนล้ม แล้วสรุปท้ายสุด
//   - ประมวลผลแบบ background task ในตัว process เดิม (ไม่ใช้ BullMQ ตอนนี้ — เก็บ
//     progress ไว้ในตาราง episode_upload_jobs ให้ frontend poll เช็คได้)
// =============================================================

import AdmZip from 'adm-zip'
import mammoth from 'mammoth'
import { db } from '../../db'
import { autoChunkText, createEpisode } from './writer.service'

const MAX_ZIP_SIZE = 50 * 1024 * 1024 // 50MB รวมทั้ง zip
const MAX_FILE_COUNT = 200            // ไฟล์สูงสุดต่อ zip (กันเซิร์ฟค้าง)

interface ParsedEntry {
  filename: string
  order: number
  title: string | null // null = ใช้ fallback "ตอนที่ N"
  ext: 'txt' | 'docx'
  buffer: Buffer
}

interface FailedFile {
  filename: string
  reason: string
}

// 2026-08-10 user ขอ — เดิมเก็บแค่ไฟล์ที่ล้มเหลว ไม่มีบันทึกว่าไฟล์ไหนกลายเป็นตอนอะไรบ้าง ทำให้
// สรุปผลได้แค่ตัวเลข ไม่มีรายละเอียดให้ดูทีละไฟล์ (ดู migration 045)
interface SucceededFile {
  filename: string
  ep_no: number
  ep_name: string
}

// ค่ากลางของทุกตอนใน batch — รับจากฟอร์ม "เพิ่มหลายตอน" แล้วส่งผ่านเข้า
// createEpisode ทีละไฟล์ เพื่อให้ผลลัพธ์เทียบเท่าการตั้งค่าตอนเดี่ยว
export interface BulkEpisodeSettings {
  epPrice?: string
  publishStatus?: 'now' | 'schedule' | 'hide'
  scheduleDatetime?: Date
  readerMessage?: string | null
  episodeLabel?: string | null
}

// ---- แยกชื่อไฟล์รูปแบบ "N.ext" หรือ "N_ชื่อตอน.ext" ----
const FILENAME_PATTERN = /^(\d+)(?:_(.+))?\.(txt|docx)$/i

// export ไว้ให้ admin-house-writer.service.ts (อัพนิยายหลายเรื่องพร้อมกัน) เรียกใช้ซ้ำได้ — logic
// แกะชื่อไฟล์เดียวกันเป๊ะ ไม่ต้องเขียนซ้ำ
export function parseFilename(fullPath: string): { order: number; title: string | null; ext: 'txt' | 'docx' } | null {
  const basename = fullPath.split('/').pop() ?? fullPath
  const match = basename.match(FILENAME_PATTERN)
  if (!match) return null

  const [, orderStr, rawTitle, ext] = match
  // _ ที่เหลือในชื่อตอน (เช่น "1_บทที่_หนึ่ง.docx") แปลงเป็นช่องว่างแทน ไม่ให้ค้างโชว์ใน UI
  const title = rawTitle ? rawTitle.replace(/_/g, ' ').trim() || null : null

  return { order: parseInt(orderStr, 10), title, ext: ext.toLowerCase() as 'txt' | 'docx' }
}

// ---- แกะเนื้อหาข้อความจาก buffer ตามนามสกุล ----
export async function extractText(buffer: Buffer, ext: 'txt' | 'docx'): Promise<string> {
  if (ext === 'txt') return buffer.toString('utf-8')
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

// ---- เริ่ม job อัปโหลดหลายตอน — validate + สร้าง job แล้วคืน job_id ทันที ----
// ตัวประมวลผลจริงรันเบื้องหลัง ไม่ await ตรงนี้ (กัน request ค้างรอ)
export async function startBulkEpisodeUpload(
  userId: bigint,
  workUuid: string,
  zipBuffer: Buffer,
  settings: BulkEpisodeSettings = {},
) {
  const work = await db
    .selectFrom('works')
    .select(['p_id', 'type', 'is_one_shot'])
    .where('uuid', '=', workUuid)
    .where('author_id', '=', userId)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')
  if (work.type !== 'novel') throw new Error('NOT_NOVEL') // ฟีเจอร์นี้หั่นข้อความเป็นตอน ใช้กับ manga ไม่ได้
  if (work.is_one_shot) throw new Error('ONE_SHOT_LIMIT')  // one-shot มีได้แค่ตอนเดียวตลอดไป

  if (zipBuffer.length > MAX_ZIP_SIZE) throw new Error('ZIP_TOO_LARGE')

  let zip: AdmZip
  try {
    zip = new AdmZip(zipBuffer)
  } catch {
    throw new Error('INVALID_ZIP')
  }

  const entries = zip.getEntries().filter((e) => !e.isDirectory)
  if (entries.length > MAX_FILE_COUNT) throw new Error('TOO_MANY_FILES')

  const parsed: ParsedEntry[] = entries
    .map((entry) => {
      const p = parseFilename(entry.entryName)
      if (!p) return null
      return { filename: entry.entryName, order: p.order, title: p.title, ext: p.ext, buffer: entry.getData() }
    })
    .filter((e): e is ParsedEntry => e !== null)
    .sort((a, b) => a.order - b.order)

  if (parsed.length === 0) throw new Error('NO_VALID_FILES')

  const job = await db
    .insertInto('episode_upload_jobs')
    .values({
      p_id: work.p_id,
      user_id: userId,
      status: 'processing',
      total: parsed.length,
      processed: 0,
      failed_files: JSON.stringify([]),
      succeeded_files: JSON.stringify([]),
    })
    .returning(['id'])
    .executeTakeFirstOrThrow()

  // เบื้องหลัง — ไม่ await ตรงนี้ ให้ HTTP response ตอบกลับ job_id ได้ทันที
  // ถ้า processEntries() throw นอก per-file try/catch (เช่น query เลข ep_no ล่าสุดพัง)
  // ต้องมาร์ค job เป็น 'failed' ด้วย ไม่งั้นจะค้างสถานะ 'processing' ตลอดไป ฝั่งหน้าเว็บ
  // poll ไม่รู้จบ (บั๊กจริงที่เจอจาก audit — ดู KNOWN_ISSUES.md)
  processEntries(job.id, userId, workUuid, work.p_id, parsed, settings).catch(async (err) => {
    console.error(`[bulk-upload] job ${job.id} crashed unexpectedly:`, err)
    await db
      .updateTable('episode_upload_jobs')
      .set({
        status: 'failed',
        error_message: err?.message ?? 'ไม่ทราบสาเหตุ',
        updated_at: new Date(),
      })
      .where('id', '=', job.id)
      .execute()
  })

  return { job_id: String(job.id) }
}

// ---- ประมวลผลจริงเบื้องหลัง: parse ทีละไฟล์ → สร้างตอน → อัปเดต progress ----
async function processEntries(
  jobId: bigint,
  userId: bigint,
  workUuid: string,
  pId: bigint,
  entries: ParsedEntry[],
  settings: BulkEpisodeSettings,
) {
  const failedFiles: FailedFile[] = []
  const succeededFiles: SucceededFile[] = []
  let processed = 0

  // เริ่มนับ ep_no ต่อจากเลขตอนสูงสุดเดิมของเรื่อง (ไม่ใช้เลขจากชื่อไฟล์ตรงๆ)
  const lastEp = await db
    .selectFrom('work_ep')
    .select('ep_no')
    .where('p_id', '=', pId)
    .where('status', '=', 'active')
    .orderBy('ep_no', 'desc')
    .limit(1)
    .executeTakeFirst()

  let nextEpNo = (lastEp?.ep_no ?? 0) + 1

  for (const entry of entries) {
    try {
      const rawText = await extractText(entry.buffer, entry.ext)
      const trimmed = rawText.trim()
      if (!trimmed) throw new Error('เนื้อหาว่างเปล่า')

      const blocks = autoChunkText(trimmed)
      const epName = entry.title ?? `ตอนที่ ${nextEpNo}`

      await createEpisode(userId, workUuid, {
        ep_name: epName,
        ep_no: nextEpNo,
        ep_content: blocks,
        ep_price: settings.epPrice ?? '0',
        publish_status: settings.publishStatus ?? 'hide',
        schedule_datetime: settings.scheduleDatetime,
        reader_message: settings.readerMessage ?? null,
        episode_label: settings.episodeLabel,
      })

      succeededFiles.push({ filename: entry.filename, ep_no: nextEpNo, ep_name: epName })
      nextEpNo++
    } catch (err: any) {
      failedFiles.push({ filename: entry.filename, reason: err.message ?? 'ไม่ทราบสาเหตุ' })
    }

    processed++
    await db
      .updateTable('episode_upload_jobs')
      .set({
        processed,
        failed_files:    JSON.stringify(failedFiles),
        succeeded_files: JSON.stringify(succeededFiles),
        updated_at:      new Date(),
      })
      .where('id', '=', jobId)
      .execute()
  }

  await db
    .updateTable('episode_upload_jobs')
    .set({ status: 'completed', updated_at: new Date() })
    .where('id', '=', jobId)
    .execute()
}

// ---- เช็คสถานะ job (polling) ----
export async function getBulkUploadJobStatus(userId: bigint, jobId: bigint) {
  // เช็ค ownership ที่ระดับ SQL ตรงๆ (ไม่เทียบ bigint ใน JS หลัง fetch — pg คืน BIGINT
  // เป็น string เสมอ ไม่ใช่ native bigint เทียบ !== ตรงๆ จะ false เสมอ)
  const job = await db
    .selectFrom('episode_upload_jobs')
    .select(['id', 'status', 'total', 'processed', 'failed_files', 'succeeded_files', 'error_message'])
    .where('id', '=', jobId)
    .where('user_id', '=', userId)
    .executeTakeFirst()

  if (!job) throw new Error('JOB_NOT_FOUND')

  return {
    job_id: String(job.id),
    status: job.status,
    total: job.total,
    processed: job.processed,
    failed_files: job.failed_files as FailedFile[],
    succeeded_files: job.succeeded_files as SucceededFile[],
    error_message: job.error_message,
  }
}
