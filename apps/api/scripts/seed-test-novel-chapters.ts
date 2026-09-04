import { db } from '../src/db'

const slug = process.argv[2]?.trim() || 'TEST-05'
const chapterCount = 50

interface Story {
  id: string
  title: string
  type: 'novel' | 'manga'
}

let insertedCount = 0

try {
  const [story] = await db<Story[]>`
    SELECT id, title, type
    FROM stories
    WHERE LOWER(slug) = LOWER(${slug})
      AND deleted_at IS NULL
    LIMIT 1
  `

  if (!story) {
    throw new Error(`ไม่พบเรื่องที่มี slug "${slug}"`)
  }

  if (story.type !== 'novel') {
    throw new Error(`เรื่อง "${slug}" ไม่ใช่ Novel`)
  }

  await db.begin(async (transaction) => {
    for (let chapterNumber = 1; chapterNumber <= chapterCount; chapterNumber += 1) {
      const title = `ตอนที่ ${chapterNumber}: บันทึกการเดินทางบทใหม่`
      const content = [
        `<h2>${title}</h2>`,
        '<p>แสงอาทิตย์ยามเช้าส่องผ่านหน้าต่าง ขณะที่การเดินทางครั้งใหม่กำลังจะเริ่มต้นขึ้น</p>',
        '<p>ตัวละครของเราก้าวออกไปพร้อมความหวัง และพบกับเหตุการณ์ที่ไม่เคยคาดคิดมาก่อน</p>',
        '<p>เรื่องราวในวันนี้อาจเป็นเพียงจุดเริ่มต้นของการผจญภัยที่ยิ่งใหญ่กว่าเดิม</p>',
      ].join('')

      const [chapter] = await transaction<{ id: string }[]>`
        INSERT INTO chapters (
          story_id,
          chapter_number,
          title,
          price,
          is_free,
          status,
          published_at
        ) VALUES (
          ${story.id},
          ${chapterNumber},
          ${title},
          0,
          TRUE,
          'published',
          NOW() - (${chapterCount - chapterNumber} * INTERVAL '1 hour')
        )
        ON CONFLICT (story_id, chapter_number) DO NOTHING
        RETURNING id
      `

      if (!chapter) continue

      await transaction`
        INSERT INTO novel_chapter_contents (chapter_id, content, word_count)
        VALUES (${chapter.id}, ${content}, ${content.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length})
      `
      insertedCount += 1
    }

    await transaction`
      UPDATE stories
      SET updated_at = NOW()
      WHERE id = ${story.id}
    `
  })

  console.log(
    `เตรียมตอนที่ 1-${chapterCount} สำหรับ "${story.title}" สำเร็จ (เพิ่มใหม่ ${insertedCount} ตอน)`,
  )
} finally {
  await db.close()
}
