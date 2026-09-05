import { S3Client } from 'bun'
import { Buffer } from 'node:buffer'
import sharp from 'sharp'
import { env } from '../../../config/env'

const PAGE_WIDTH = 2400
const PAGE_QUALITY = 85
const PAGE_COMPRESSION_THRESHOLD_BYTES = 700 * 1024

export interface UploadedChapterPage {
  key: string
  width: number
  height: number
}

function createR2Client() {
  if (
    !env.R2_ACCOUNT_ID
    || !env.R2_ACCESS_KEY_ID
    || !env.R2_SECRET_ACCESS_KEY
    || !env.R2_MANGA_BUCKET_NAME
  ) {
    throw new Error('R2 configuration is incomplete')
  }

  return new S3Client({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_MANGA_BUCKET_NAME,
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  })
}

export async function uploadWriterChapterPage(
  file: File,
  storyId: string,
  chapterNumber: number,
): Promise<UploadedChapterPage> {
  const input = Buffer.from(await file.arrayBuffer())
  const image = sharp(input).rotate()
  if (file.size > PAGE_COMPRESSION_THRESHOLD_BYTES) {
    image.resize({ width: PAGE_WIDTH, fit: 'inside', withoutEnlargement: true })
  }
  const { data, info } = await image
    .webp({ quality: PAGE_QUALITY })
    .toBuffer({ resolveWithObject: true })
  const key = `stories/chapters/${storyId}/${chapterNumber}/${crypto.randomUUID()}.webp`

  await createR2Client().write(key, new Blob([data], { type: 'image/webp' }), {
    type: 'image/webp',
  })

  return {
    key,
    width: info.width,
    height: info.height,
  }
}

export function createWriterChapterPageSignedUrl(key: string): string {
  return createR2Client().presign(key, {
    expiresIn: 5 * 60,
    method: 'GET',
  })
}

export async function deleteWriterChapterPage(key: string): Promise<void> {
  await createR2Client().delete(key)
}
