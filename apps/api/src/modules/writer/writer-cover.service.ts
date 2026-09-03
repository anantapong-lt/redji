import { S3Client } from 'bun'
import { env } from '../../config/env'

const extensionByMimeType = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

export async function uploadWriterCover(file: File) {
  const extension = extensionByMimeType[file.type as keyof typeof extensionByMimeType]
  if (!extension) throw new Error('Unsupported writer cover type')

  if (
    !env.R2_ACCOUNT_ID
    || !env.R2_ACCESS_KEY_ID
    || !env.R2_SECRET_ACCESS_KEY
    || !env.R2_BUCKET_NAME
    || !env.R2_PUBLIC_URL
  ) {
    throw new Error('R2 configuration is incomplete')
  }

  const key = `stories/covers/${crypto.randomUUID()}.${extension}`
  const r2 = new S3Client({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET_NAME,
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  })

  await r2.write(key, file, { type: file.type })

  return {
    key,
    cover_url: `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`,
  }
}
