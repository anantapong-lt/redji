import { Buffer } from 'node:buffer'
import { db } from '../src/db'
import { createWriterCoverBlurDataUrl } from '../src/modules/writer/content/writer-cover.service'

interface StoryCover {
  id: string
  cover_url: string
}

let updatedCount = 0
let failedCount = 0

try {
  const stories = await db<StoryCover[]>`
    SELECT id, cover_url
    FROM stories
    WHERE cover_url IS NOT NULL
      AND cover_blur_data_url IS NULL
      AND deleted_at IS NULL
    ORDER BY id
  `

  for (const story of stories) {
    try {
      const response = await fetch(story.cover_url)
      if (!response.ok) {
        throw new Error(`Cover request failed with status ${response.status}`)
      }

      const cover = Buffer.from(await response.arrayBuffer())
      const blurDataUrl = await createWriterCoverBlurDataUrl(cover)

      await db`
        UPDATE stories
        SET cover_blur_data_url = ${blurDataUrl}
        WHERE id = ${story.id}
          AND cover_url = ${story.cover_url}
          AND cover_blur_data_url IS NULL
      `
      updatedCount += 1
    } catch (error) {
      failedCount += 1
      console.error(`Unable to create cover blur for story ${story.id}`, error)
    }
  }

  console.log(`Cover blur backfill completed: ${updatedCount} updated, ${failedCount} failed`)
} finally {
  await db.close()
}
