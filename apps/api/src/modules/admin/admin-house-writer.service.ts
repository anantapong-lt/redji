// =============================================================
// Novel Platform — Admin House-Writer Service (2026-08-10, ใหม่)
// วางไว้ที่: apps/api/src/modules/admin/admin-house-writer.service.ts
// =============================================================
//
// แท็บ "เพิ่มนักเขียนของเว็บ" — แอดมิน (level >= 9) สร้าง/อัพนิยายแทนบัญชี "นักเขียนของเว็บ"
// (level 7 — บัญชีผีที่บริษัทคุมเอง ใช้ปั้นเนื้อหา/ย้ายข้อมูลก้อนใหญ่ มติ 2026-08-10) ทุกฟังก์ชัน
// ในไฟล์นี้เช็คว่าบัญชีเป้าหมายเป็น level 7 จริงก่อนเสมอ (กันเรียก endpoint ตรงๆ ข้าม UI ไปยิงใส่
// นักเขียนอิสระ level 6 ทั่วไป) — สร้างผ่าน createWork/createEpisode/uploadCover ของ
// writer.service.ts ตรงๆ (สวม target_user_id เป็นเจ้าของ เหมือน pattern เดียวกับ
// admin-works.service.ts) ทุกเรื่องที่สร้างจากที่นี่ publish_status=0 (ซ่อน) เสมอโดยธรรมชาติ
// (createWork บังคับไว้อยู่แล้ว ไม่ต้องเช็คซ้ำ)
//
// "เพิ่มนิยายหลายเรื่อง" — โครงสร้าง zip: โฟลเดอร์ระดับบนสุด = 1 นิยาย ข้างในมีไฟล์ตอน (.txt/.docx)
// + รูปปก 1 ไฟล์ (เดาจากนามสกุลไฟล์รูปที่เจอในโฟลเดอร์ ไม่ต้องตั้งชื่อไฟล์บอกว่าอันไหนคือปก)
// ประมวลผลเบื้องหลังทีละโฟลเดอร์ ไม่ await ตรง route — โฟลเดอร์ไหนพัง ข้ามไปทำโฟลเดอร์ถัดไป ไม่ทำให้
// batch ทั้งก้อนล้ม (เหมือน pattern เดิมของ processEntries ของนักเขียน)
//
// ⚠️ เจอไฟล์รูปในโฟลเดอร์เดียวกันเกิน 1 ไฟล์ = reject นิยายเรื่องนั้นทั้งเรื่อง (ไม่สร้างเลย ไม่เดาว่า
// อันไหนคือปก) เพราะชื่อไฟล์ตั้งใจให้เป็นมั่วได้ ระบบไม่มีทางแยกได้ว่าอันไหนคือปกจริง — โฟลเดอร์อื่นที่ไม่
// เจอปัญหานี้ไม่กระทบ (มติ 2026-08-10 ตอบคำถาม user ว่า "ปกเกินต้องเด้งเรื่องนั้นออก")
//
// ⚠️ เลขตอน (ep_no) — ต่างจากระบบ "เพิ่มอัตโนมัติ" ของนักเขียน (writer.bulk-upload.service.ts)
// เจตนา! ของนักเขียนเดิม เลขในชื่อไฟล์เป็นแค่ตัวจัดลำดับการประมวลผล ส่วนเลขตอนจริงนับต่อจากตอนสุดท้าย
// ของเรื่องเดิม (เหมาะกับ "เพิ่มตอนใหม่ต่อจากที่มีอยู่แล้ว") แต่ที่นี่ทุกนิยายเป็นเรื่องใหม่ล้วนๆ ไม่มีตอน
// เดิมมาก่อน — ใช้ parser คนละตัวกับของนักเขียน (parseFilenameLenient ด้านล่าง) ที่ผ่อนปรนกว่า —
// ไม่บังคับ "_" คั่นชื่อตอน รับได้ทั้งเลขจำนวนเต็ม/ทศนิยม ส่วนหลังเลขจะเป็นอะไรก็ได้ (เช่น "44xx.txt",
// "44(c).txt" ก็ยังดึงเลข 44 มาใช้ได้) กันไฟล์หายเงียบๆ แบบที่ user เจอตอนทดสอบจริง
//
// ep_no ที่บันทึกจริง = ลำดับต่อเนื่อง 1,2,3... เรียงตามเลขที่ parse ได้ (int/ทศนิยมเรียงปนกันถูกต้อง
// เช่น 44 < 46 < 46.5 < 47) "ไม่ใช่" เลขจากไฟล์ตรงๆ (2026-08-10 ตัดสินใจร่วมกับ user หลังพบว่า ep_no
// เป็น INTEGER ล้วนและถูกใช้ตรงๆ ใน URL อ่านตอน + โชว์เป็นตัวเลขจริงในหน้าอ่าน/สารบัญตอน — เปลี่ยนเป็น
// ทศนิยมได้แต่กระทบทั้งระบบ เกินขอบเขตงานนี้ ดู formatEpisodeHeaderTitle/formatEpisodeOrder ฝั่ง
// apps/web) เลขเต็มจากไฟล์ (รวมทศนิยม) ยังโชว์ให้เห็นตรงๆ ผ่านชื่อตอน (ep_name) เสมอ ถ้าไฟล์ไม่ได้ตั้ง
// ชื่อกำกับเอง

import AdmZip from 'adm-zip'
import { db } from '../../db'
import { createWork, createEpisode, uploadCover, autoChunkText, type CreateWorkInput } from '../writer/writer.service'
import { extractText } from '../writer/writer.bulk-upload.service'
import type { NovelBlock } from '../../db/types'
import { writeAuditLog } from './admin.service'

const MAX_ZIP_SIZE = 500 * 1024 * 1024 // 500MB — ปกรูปรวมกันของ ~100 เรื่องเป็นตัวกินพื้นที่หลัก
const MAX_FOLDER_COUNT = 150            // เผื่อเหนือ ~100 เรื่องที่ user บอกไว้
const MAX_TOTAL_ENTRIES = 5000          // กัน zip ที่มีไฟล์ย่อยจำนวนมากผิดปกติ (zip bomb เชิงจำนวนไฟล์)

const COVER_EXT_TO_MIME: Record<string, string> = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
}

// ---- Parser ผ่อนปรน เฉพาะฝั่งแอดมิน "เพิ่มนิยายหลายเรื่อง" (ดูเหตุผลยาวๆ ที่หัวไฟล์) ----
// รับ "N" หรือ "N.M" นำหน้า (จำนวนเต็ม/ทศนิยม) ตามด้วยอะไรก็ได้ก่อน .txt/.docx — ไม่บังคับ "_"
const LENIENT_FILENAME_PATTERN = /^(\d+(?:\.\d+)?)(.*)\.(txt|docx)$/i

function parseFilenameLenient(fullPath: string): { order: number; title: string | null; ext: 'txt' | 'docx' } | null {
  const basename = fullPath.split('/').pop() ?? fullPath
  const match = basename.match(LENIENT_FILENAME_PATTERN)
  if (!match) return null

  const [, orderStr, rawRest, ext] = match
  // มี "_" นำหน้าข้อความที่เหลือ → ตัด "_" ตัวแรกออกแล้วใช้เป็นชื่อตอน (เหมือนของนักเขียนเดิม) ไม่มี "_"
  // แต่ยังมีข้อความเหลืออยู่ (เช่น "44xx", "(c)", " ตอนที่1") → ใช้ข้อความนั้นตรงๆ เป็นชื่อตอนเลย ดีกว่า
  // ทิ้งไปเฉยๆ (ให้เห็นว่าไฟล์เดิมชื่ออะไรมา เผื่อต้องไปแก้เอง)
  const title = rawRest.startsWith('_')
    ? rawRest.slice(1).replace(/_/g, ' ').trim() || null
    : rawRest.trim() || null

  return { order: parseFloat(orderStr), title, ext: ext.toLowerCase() as 'txt' | 'docx' }
}

// ---- ตัวกรองภาษาต่างประเทศ (2026-08-10 user ขอ) — toggle ได้เฉพาะฝั่งแอดมินเท่านั้น ----
// เจอในไฟล์นิยายแปลบ่อยๆ ที่ผู้แปลแปะต้นฉบับเกาหลี/อังกฤษไว้ใต้คำแปลไทย ตัด chunk ที่ไม่มีภาษาไทยเลย
// ทิ้งทั้งก้อน แต่ chunk ไหนมีภาษาไทยปนอยู่ด้วย (ต่อให้มีคำอังกฤษ/เกาหลีแทรกอยู่ด้วย) จะไม่แตะเลย กัน
// กรณีเขียนคำอังกฤษเล็กน้อยปนในประโยคไทยปกติ
const THAI_RE = /[฀-๿]/
const FOREIGN_LETTER_RE = /[a-zA-Z가-힣ᄀ-ᇿ㄰-㆏]/

function shouldDropForeignChunk(text: string): boolean {
  return FOREIGN_LETTER_RE.test(text) && !THAI_RE.test(text)
}

interface FailedItem {
  folder_name: string
  reason: string
}

interface EpisodeOutcome {
  filename: string
  ep_no: number | null
  ep_name: string
  status: 'success' | 'failed'
  reason?: string
}

interface CreatedWork {
  uuid: string
  title: string
  /** สรุปสั้นๆ 1 บรรทัด — มีค่าเมื่อสร้างนิยายสำเร็จ แต่ปก/บางตอนพังบางส่วน */
  note?: string
  episodes: EpisodeOutcome[]
}

// ---- เช็คว่าบัญชีเป้าหมายเป็น "นักเขียนของเว็บ" (level 7) จริง — ใช้ร่วมทั้ง 2 ฟังก์ชันด้านล่าง ----
async function resolveHouseWriter(userUuid: string): Promise<{ id: bigint; display_name: string }> {
  const user = await db
    .selectFrom('users')
    .select(['id', 'level', 'display_name'])
    .where('uuid', '=', userUuid)
    .executeTakeFirst()

  if (!user) throw new Error('USER_NOT_FOUND')
  if (user.level !== 7) throw new Error('NOT_HOUSE_WRITER')

  return { id: user.id, display_name: user.display_name }
}

// =============================================================
// เพิ่มนิยายใหม่ (เรื่องเดียว)
// =============================================================
export async function createWorkForHouseWriter(
  adminId: bigint,
  targetUuid: string,
  data: CreateWorkInput,
) {
  const target = await resolveHouseWriter(targetUuid)
  const work = await createWork(target.id, data)
  await writeAuditLog(adminId, 'ADMIN_CREATE_WORK_FOR_HOUSE_WRITER', 'work', work.uuid, `${target.display_name}: ${data.title}`)
  return work
}

// =============================================================
// เพิ่มนิยายหลายเรื่อง (bulk zip — หลายโฟลเดอร์)
// =============================================================
export async function startNovelBulkUpload(
  adminId: bigint,
  targetUuid: string,
  zipBuffer: Buffer,
  stripForeignChunks: boolean,
) {
  const target = await resolveHouseWriter(targetUuid)

  if (zipBuffer.length > MAX_ZIP_SIZE) throw new Error('ZIP_TOO_LARGE')

  let zip: AdmZip
  try {
    zip = new AdmZip(zipBuffer)
  } catch {
    throw new Error('INVALID_ZIP')
  }

  const entries = zip.getEntries().filter((e) => !e.isDirectory)
  if (entries.length > MAX_TOTAL_ENTRIES) throw new Error('TOO_MANY_FILES')

  // จัดกลุ่มตามโฟลเดอร์ระดับบนสุด — ไฟล์ที่ลอยอยู่ root โดยไม่มีโฟลเดอร์ครอบ ข้ามไปเลย (ไม่ใช่โครงสร้าง
  // ที่ระบบนี้รองรับ) ข้าม __MACOSX/ (โฟลเดอร์ metadata ที่ Finder ของ mac แทรกมาเองตอน zip ให้ทุก
  // โฟลเดอร์เสมอ) กับไฟล์ที่ชื่อขึ้นต้นด้วยจุด (.DS_Store ฯลฯ) ไม่งั้นจะโดนนับเป็น "นิยาย" หลอกๆ เพิ่มมา
  const folderMap = new Map<string, AdmZip.IZipEntry[]>()
  for (const entry of entries) {
    const parts = entry.entryName.split('/')
    if (parts.length < 2) continue
    const folderName = parts[0].trim()
    if (!folderName || folderName === '__MACOSX') continue
    const basename = parts[parts.length - 1]
    if (basename.startsWith('.')) continue
    if (!folderMap.has(folderName)) folderMap.set(folderName, [])
    folderMap.get(folderName)!.push(entry)
  }

  if (folderMap.size === 0) throw new Error('NO_VALID_FOLDERS')
  if (folderMap.size > MAX_FOLDER_COUNT) throw new Error('TOO_MANY_FOLDERS')

  const job = await db
    .insertInto('admin_novel_upload_jobs')
    .values({
      admin_id:       adminId,
      target_user_id: target.id,
      status:         'processing',
      total:          folderMap.size,
      processed:      0,
      failed_items:   JSON.stringify([]),
      created_works:  JSON.stringify([]),
    })
    .returning(['id'])
    .executeTakeFirstOrThrow()

  // เบื้องหลัง — ไม่ await ตรงนี้ ให้ HTTP response ตอบกลับ job_id ได้ทันที (batch นี้อาจใช้เวลานาน
  // เป็นนาทีถ้ามีนิยายเป็นร้อยเรื่อง) ถ้า processFolders() throw นอก per-folder try/catch ต้องมาร์ค
  // job เป็น 'failed' ด้วย ไม่งั้นจะค้างสถานะ 'processing' ตลอดไป (บั๊กเดิมที่เจอกับ
  // episode_upload_jobs มาก่อนแล้ว — ดู migration 016)
  processFolders(job.id, target.id, folderMap, stripForeignChunks).catch(async (err) => {
    console.error(`[admin-novel-bulk-upload] job ${job.id} crashed unexpectedly:`, err)
    await db
      .updateTable('admin_novel_upload_jobs')
      .set({ status: 'failed', error_message: err?.message ?? 'ไม่ทราบสาเหตุ', updated_at: new Date() })
      .where('id', '=', job.id)
      .execute()
  })

  await writeAuditLog(
    adminId,
    'ADMIN_BULK_UPLOAD_NOVELS_FOR_HOUSE_WRITER',
    'user',
    targetUuid,
    `${target.display_name}: ${folderMap.size} เรื่อง (job ${job.id})`,
  )

  return { job_id: String(job.id), total: folderMap.size }
}

// ---- ประมวลผลจริงเบื้องหลัง: ทีละโฟลเดอร์ → สร้างนิยาย + ปก + ตอน → อัปเดต progress ----
async function processFolders(
  jobId: bigint,
  targetUserId: bigint,
  folders: Map<string, AdmZip.IZipEntry[]>,
  stripForeignChunks: boolean,
) {
  const failedItems: FailedItem[] = []
  const createdWorks: CreatedWork[] = []
  let processed = 0

  async function saveProgress() {
    processed++
    await db
      .updateTable('admin_novel_upload_jobs')
      .set({ processed, failed_items: JSON.stringify(failedItems), created_works: JSON.stringify(createdWorks), updated_at: new Date() })
      .where('id', '=', jobId)
      .execute()
  }

  for (const [folderName, folderEntries] of folders) {
    // ไฟล์ชื่อมั่วได้ (user ตั้งใจให้โยนไฟล์เข้าโฟลเดอร์เฉยๆ ไม่ต้องตั้งชื่อพิเศษบอกว่าอันไหนคือปก) —
    // เดาปกจาก "นามสกุลไฟล์รูป" ล้วนๆ แปลว่าถ้าเจอเกิน 1 ไฟล์ ระบบไม่มีทางรู้ว่าอันไหนคือปกจริง เลย
    // reject ทั้งโฟลเดอร์ไปเลย (ไม่สร้างนิยายเรื่องนี้เลย) ดีกว่าเดามั่วแล้วได้ปกผิด — เช็คตรงนี้ก่อน
    // createWork เสมอ กันสร้างนิยายเปล่าทิ้งไว้เฉยๆ ถ้าสุดท้ายต้อง reject อยู่ดี
    const coverCandidates = folderEntries.filter((e) => {
      const ext = e.entryName.split('.').pop()?.toLowerCase()
      return ext ? ext in COVER_EXT_TO_MIME : false
    })
    if (coverCandidates.length > 1) {
      const filenames = coverCandidates.map((e) => e.entryName.split('/').pop()).join(', ')
      failedItems.push({
        folder_name: folderName,
        reason: `มีไฟล์รูปที่อาจเป็นปกเกิน 1 ไฟล์ (${coverCandidates.length} ไฟล์: ${filenames}) — เหลือรูปเดียวในโฟลเดอร์นี้แล้วอัปโหลดใหม่`,
      })
      await saveProgress()
      continue
    }
    const coverEntry = coverCandidates[0]

    // แยก error ของ "สร้างนิยายไม่สำเร็จเลย" (failedItems — ไม่มีอะไรถูกสร้างขึ้นมาจริง) ออกจาก
    // "สร้างนิยายสำเร็จ แต่ปก/บางตอนพัง" (createdWorks + note — นิยายมีอยู่จริง แก้ไขต่อได้ที่หน้า
    // /works/[uuid] เอง ไม่ควรถูกนับเป็น "ล้มเหลว" ทั้งเรื่องทั้งที่จริงๆ สร้างสำเร็จไปแล้ว)
    let work: { uuid: string; title: string }
    try {
      work = await createWork(targetUserId, { title: folderName, type: 'novel' })
    } catch (err: any) {
      failedItems.push({ folder_name: folderName, reason: err.message ?? 'ไม่ทราบสาเหตุ' })
      await saveProgress()
      continue
    }

    // feedback รายงานผล (2026-08-10 user ขอ) — อยากรู้ว่าเรื่องไหนปกหาย/มีปัญหาอะไรบ้างหลังอัพเสร็จ
    const notes: string[] = []

    if (coverEntry) {
      try {
        const ext = coverEntry.entryName.split('.').pop()!.toLowerCase()
        await uploadCover(targetUserId, work.uuid, coverEntry.getData(), COVER_EXT_TO_MIME[ext], coverEntry.entryName)
      } catch (err: any) {
        notes.push(`อัปโหลดปกไม่สำเร็จ: ${err.message ?? 'ไม่ทราบสาเหตุ'}`)
      }
    } else {
      notes.push('ไม่พบไฟล์ปกในโฟลเดอร์นี้')
    }

    // ไฟล์ตอน — เลขนำหน้าชื่อไฟล์ "เป็น" เลขตอนจริงตรงๆ (ดูเหตุผลที่หัวไฟล์) ไฟล์ไหน parse ไม่ได้เลย
    // (ไม่มีเลขนำหน้า) ก็ยังบันทึกไว้ใน episodes เป็น 'failed' ให้เห็นครบทุกไฟล์ ไม่หายไปเงียบๆ
    const episodeOutcomes: EpisodeOutcome[] = []
    const parsedEntries: { filename: string; order: number; title: string | null; ext: 'txt' | 'docx'; buffer: Buffer }[] = []

    for (const entry of folderEntries) {
      if (entry === coverEntry) continue
      const filename = entry.entryName.split('/').pop() ?? entry.entryName
      const p = parseFilenameLenient(entry.entryName)
      if (!p) {
        episodeOutcomes.push({ filename, ep_no: null, ep_name: filename, status: 'failed', reason: 'ชื่อไฟล์ไม่มีเลขตอนนำหน้า ไม่ถูกนำเข้า' })
        continue
      }
      parsedEntries.push({ filename, order: p.order, title: p.title, ext: p.ext, buffer: entry.getData() })
    }
    parsedEntries.sort((a, b) => a.order - b.order)

    // 2026-08-10 — เปลี่ยนตามที่ user ยืนยัน: ep_no ในระบบเป็น INTEGER ล้วน และไม่ใช่แค่ตัวจัดเรียง
    // ภายในเฉยๆ — ไปโผล่ตรงๆ ใน URL อ่านตอน (/works/[uuid]/read/[epNo]) และโชว์เป็นตัวเลขจริงในหน้า
    // อ่าน/สารบัญตอน (ดู formatEpisodeHeaderTitle, formatEpisodeOrder ฝั่ง apps/web) เปลี่ยนคอลัมน์
    // เป็นทศนิยมได้แต่กระทบทั้งระบบ (URL, ระบบซื้อ, TTS, คอมเมนต์ต่อตอน) เกินขอบเขตงานนี้ — ทางที่
    // ปลอดภัยกว่าคือ ep_no เรียงเป็นเลขจำนวนเต็มต่อเนื่อง 1,2,3... ตาม "ลำดับที่ถูกต้อง" ของเลขในชื่อไฟล์
    // (จำนวนเต็ม/ทศนิยมเรียงปนกันได้ถูกต้อง เช่น 44 < 46 < 46.5 < 47) ส่วนเลขเต็มจากไฟล์ (เช่น "46.5")
    // ยังโชว์ให้เห็นตรงๆ ผ่านชื่อตอน (ep_name) เสมอ — อ่านลำดับถูกต้อง เห็นเลขเดิมจากไฟล์ครบ แค่เลข
    // ep_no ภายในไม่ใช่ตัวเดียวกับเลขในชื่อไฟล์ตรงๆ อีกต่อไป
    let epNo = 1
    for (const ep of parsedEntries) {
      const epName = ep.title ?? `ตอนที่ ${ep.order}`

      try {
        const rawText = await extractText(ep.buffer, ep.ext)
        const trimmed = rawText.trim()
        if (!trimmed) {
          episodeOutcomes.push({ filename: ep.filename, ep_no: null, ep_name: epName, status: 'failed', reason: 'เนื้อหาว่างเปล่า' })
          continue
        }

        let blocks: NovelBlock[] = autoChunkText(trimmed)
        if (stripForeignChunks) blocks = blocks.filter((b) => !shouldDropForeignChunk(b.text))

        await createEpisode(targetUserId, work.uuid, {
          ep_name:        epName,
          ep_no:          epNo,
          ep_content:     blocks,
          ep_price:       '0',
          publish_status: 'hide',
        })
        episodeOutcomes.push({ filename: ep.filename, ep_no: epNo, ep_name: epName, status: 'success' })
        epNo++
      } catch (err: any) {
        episodeOutcomes.push({ filename: ep.filename, ep_no: null, ep_name: epName, status: 'failed', reason: err.message ?? 'ไม่ทราบสาเหตุ' })
      }
    }

    const failedCount = episodeOutcomes.filter((e) => e.status !== 'success').length
    if (failedCount > 0) notes.push(`มีไฟล์ตอนที่ไม่สำเร็จ ${failedCount} จาก ${episodeOutcomes.length} ไฟล์`)

    createdWorks.push({
      uuid:     work.uuid,
      title:    work.title,
      episodes: episodeOutcomes,
      ...(notes.length > 0 ? { note: notes.join(' / ') } : {}),
    })

    await saveProgress()
  }

  await db
    .updateTable('admin_novel_upload_jobs')
    .set({ status: 'completed', updated_at: new Date() })
    .where('id', '=', jobId)
    .execute()
}

// ---- เช็คสถานะ job (polling) ----
export async function getNovelBulkUploadJobStatus(adminId: bigint, jobId: bigint) {
  const job = await db
    .selectFrom('admin_novel_upload_jobs')
    .select(['id', 'status', 'total', 'processed', 'failed_items', 'created_works', 'error_message'])
    .where('id', '=', jobId)
    .where('admin_id', '=', adminId)
    .executeTakeFirst()

  if (!job) throw new Error('JOB_NOT_FOUND')

  return {
    job_id:        String(job.id),
    status:        job.status,
    total:         job.total,
    processed:     job.processed,
    failed_items:  job.failed_items as FailedItem[],
    created_works: job.created_works as CreatedWork[],
    error_message: job.error_message,
  }
}
