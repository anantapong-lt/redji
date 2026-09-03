import { db } from './index'
import { registerUser } from '../modules/auth/auth.service'

const WORK_COUNT = 10
const EPISODES_PER_WORK = 5
const PAID_EPISODE_PRICE = '5'
const MOCK_WRITER_USERNAME = '_mock_manga_writer'
const MOCK_WRITER_EMAIL = 'mock-manga-writer@example.com'
const MOCK_WRITER_PASSWORD = 'MockWriter123!'
const SEED_MARKER = '[mock-manga-seed]'

const coverPhotoIds = [
  '1612036782180-6f0b6cd846fe',
  '1541562232579-512a21360020',
  '1578632767115-351597cf2477',
  '1608889476561-6242cfdbf622',
  '1612178537253-bccd437b730e',
]

const episodePhotoIds = [
  '1612036782180-6f0b6cd846fe',
  '1541562232579-512a21360020',
  '1578632767115-351597cf2477',
  '1608889476561-6242cfdbf622',
  '1612178537253-bccd437b730e',
  '1517841905240-472988babdf9',
  '1534528741775-53994a69daeb',
  '1524504388940-b1c1722653e1',
  '1500648767791-00dcc994a43e',
  '1494790108377-be9c29b29330',
]

const titles = [
  'ผู้พิทักษ์แห่งนครลอยฟ้า',
  'จอมเวทฝึกหัดกับมังกรตัวสุดท้าย',
  'ร้านสะดวกซื้อข้ามมิติ',
  'นักดาบแห่งแสงจันทร์',
  'ภารกิจลับของเจ้าหญิงปีศาจ',
  'ชมรมสืบสวนหลังเลิกเรียน',
  'ย้อนเวลามาเป็นฮีโร่',
  'ผู้กล้าร้านขนมหวาน',
  'บันทึกการเดินทางของแมวดำ',
  'สงครามจักรกลแดนเวทมนตร์',
]

function mockWorkUuid(index: number): string {
  return `00000000-0000-7000-8000-${String(index + 1).padStart(12, '0')}`
}

function unsplashUrl(photoId: string, width: number, height: number): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&h=${height}&q=80`
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  const databaseHost = new URL(databaseUrl).hostname.toLowerCase()
  const isLocalDatabase = ['localhost', '127.0.0.1', '::1'].includes(databaseHost)
  if (process.env.NODE_ENV === 'production' || !isLocalDatabase) {
    throw new Error('สคริปต์นี้อนุญาตให้สร้าง Mock Writer ในฐานข้อมูล local development เท่านั้น')
  }

  let writer = await db
    .selectFrom('users')
    .select(['id', 'u_name', 'display_name'])
    .where('level', '>=', 6)
    .where('level', '<=', 7)
    .orderBy('created_at', 'asc')
    .orderBy('id', 'asc')
    .executeTakeFirst()

  if (!writer) {
    const existingMockUser = await db
      .selectFrom('users')
      .select(['id', 'u_name', 'email'])
      .where((eb) => eb.or([
        eb('u_name', '=', MOCK_WRITER_USERNAME),
        eb('email', '=', MOCK_WRITER_EMAIL),
      ]))
      .executeTakeFirst()

    if (
      existingMockUser
      && (existingMockUser.u_name !== MOCK_WRITER_USERNAME || existingMockUser.email !== MOCK_WRITER_EMAIL)
    ) {
      throw new Error('username หรือ email สำหรับ Mock Writer ถูกบัญชีอื่นใช้งานแล้ว')
    }

    const mockUserId = existingMockUser?.id ?? BigInt((await registerUser({
      u_name: MOCK_WRITER_USERNAME,
      display_name: 'Mock Manga Writer',
      email: MOCK_WRITER_EMAIL,
      password: MOCK_WRITER_PASSWORD,
    })).id)

    await db
      .updateTable('users')
      .set({ level: 6, updated_at: new Date() })
      .where('id', '=', mockUserId)
      .execute()

    writer = await db
      .selectFrom('users')
      .select(['id', 'u_name', 'display_name'])
      .where('id', '=', mockUserId)
      .executeTakeFirstOrThrow()

    console.log(`สร้าง Mock Writer แล้ว: ${MOCK_WRITER_EMAIL}`)
  }

  const category = await db
    .selectFrom('categories')
    .select('id')
    .where('status', '=', true)
    .orderBy('id', 'asc')
    .executeTakeFirst()

  await db.transaction().execute(async (trx) => {
    for (let workIndex = 0; workIndex < WORK_COUNT; workIndex += 1) {
      const uuid = mockWorkUuid(workIndex)
      const title = titles[workIndex]
      const tags = ['การ์ตูน', 'แฟนตาซี', 'ผจญภัย']
      const workValues = {
        title,
        original_title: `Mock Manga ${workIndex + 1}`,
        description: `${SEED_MARKER} ข้อมูลตัวอย่างสำหรับทดสอบระบบการ์ตูน เรื่องที่ ${workIndex + 1}`,
        synopsis: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: `เรื่องราวการผจญภัยของตัวละครใน ${title}` }],
            },
          ],
        },
        cover_image: unsplashUrl(coverPhotoIds[workIndex % coverPhotoIds.length], 800, 1200),
        author_id: writer.id,
        category_main: category?.id ?? null,
        category_sub: null,
        type: 'manga' as const,
        origin_type: 1 as const,
        age_rate: 'all' as const,
        is_translated: false,
        tags,
        is_one_shot: false,
        publish_status: 1 as const,
        completion_status: 'ongoing' as const,
        episode_label: 'ตอนที่',
        status: 'active' as const,
        banned: null,
        deleted_at: null,
        deleted_by: null,
        updated_at: new Date(),
        updated_by: writer.id,
      }

      const existingWork = await trx
        .selectFrom('works')
        .select(['p_id', 'description'])
        .where('uuid', '=', uuid)
        .executeTakeFirst()

      if (existingWork && !existingWork.description?.startsWith(SEED_MARKER)) {
        throw new Error(`UUID ${uuid} ถูกใช้งานโดยข้อมูลที่ไม่ได้มาจาก mock manga seed`)
      }

      const work = existingWork
        ? await trx
            .updateTable('works')
            .set(workValues)
            .where('p_id', '=', existingWork.p_id)
            .returning('p_id')
            .executeTakeFirstOrThrow()
        : await trx
            .insertInto('works')
            .values({
              uuid,
              ...workValues,
              created_by: writer.id,
            })
            .returning('p_id')
            .executeTakeFirstOrThrow()

      const tagRows = await Promise.all(
        tags.map(async (name) => {
          const existingTag = await trx
            .selectFrom('tags')
            .select('id')
            .where('name', '=', name)
            .executeTakeFirst()

          if (existingTag) return existingTag

          return await trx
            .insertInto('tags')
            .values({ name, created_by: writer.id })
            .returning('id')
            .executeTakeFirstOrThrow()
        }),
      )

      await trx.deleteFrom('work_tags').where('p_id', '=', work.p_id).execute()
      await trx
        .insertInto('work_tags')
        .values(tagRows.map((tag) => ({
          p_id: work.p_id,
          tag_id: tag.id,
          author_id: writer.id,
        })))
        .execute()

      for (let episodeIndex = 0; episodeIndex < EPISODES_PER_WORK; episodeIndex += 1) {
        const epNo = episodeIndex + 1
        const imageCount = 5 + ((workIndex + episodeIndex) % 6)
        const episodeValues = {
          ep_name: `การเดินทางครั้งที่ ${epNo}`,
          ep_price: epNo === 1 ? '0' : PAID_EPISODE_PRICE,
          ep_content: null,
          total_image: imageCount,
          image_protection: false,
          reader_message: 'ขอบคุณที่ติดตามการ์ตูนตัวอย่างเรื่องนี้',
          episode_label: 'ตอนที่',
          publish_status: 'now' as const,
          schedule_datetime: null,
          lock_duration_days: null,
          status: 'active' as const,
          updated_at: new Date(),
          updated_by: writer.id,
        }

        const existingEpisode = await trx
          .selectFrom('work_ep')
          .select('ep_id')
          .where('p_id', '=', work.p_id)
          .where('ep_no', '=', epNo)
          .where('status', '=', 'active')
          .executeTakeFirst()

        const episode = existingEpisode
          ? await trx
              .updateTable('work_ep')
              .set(episodeValues)
              .where('ep_id', '=', existingEpisode.ep_id)
              .returning('ep_id')
              .executeTakeFirstOrThrow()
          : await trx
              .insertInto('work_ep')
              .values({
                p_id: work.p_id,
                ep_no: epNo,
                ...episodeValues,
                created_by: writer.id,
              })
              .returning('ep_id')
              .executeTakeFirstOrThrow()

        await trx.deleteFrom('work_ep_image').where('ep_id', '=', episode.ep_id).execute()
        await trx
          .insertInto('work_ep_image')
          .values(Array.from({ length: imageCount }, (_, imageIndex) => ({
            ep_id: episode.ep_id,
            p_id: work.p_id,
            ep_no: epNo,
            image_path: unsplashUrl(
              episodePhotoIds[(workIndex + episodeIndex + imageIndex) % episodePhotoIds.length],
              1200,
              1800,
            ),
            sort_order: imageIndex,
          })))
          .execute()
      }
    }
  })

  console.log(`Seed สำเร็จ: การ์ตูน ${WORK_COUNT} เรื่อง เรื่องละ ${EPISODES_PER_WORK} ตอน`)
  console.log(`Writer: ${writer.display_name} (@${writer.u_name}, id=${writer.id})`)
}

main()
  .catch((error) => {
    console.error('Seed mock manga ไม่สำเร็จ:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.destroy()
  })
