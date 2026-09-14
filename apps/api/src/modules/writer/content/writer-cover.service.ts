import { S3Client } from 'bun'
import { Buffer } from 'node:buffer'
import sharp from 'sharp'
import { env } from '../../../config/env'

const SUPPORTED_WRITER_COVER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const OPTIMIZED_WRITER_COVER_TYPE = 'image/webp'
const OPTIMIZED_WRITER_COVER_EXTENSION = 'webp'
const DEFAULT_WRITER_COVER_QUALITY = 80
const DEFAULT_WRITER_COVER_WIDTH = 1200
const DEFAULT_WRITER_COVER_HEIGHT = 1600
const WRITER_COVER_BLUR_WIDTH = 24
const WRITER_COVER_BLUR_QUALITY = 40

export interface WriterCoverOptimizationOptions {
  quality?: number | string
  width?: number | string
  height?: number | string
}

interface OptimizedWriterCover {
  body: Blob
  contentType: typeof OPTIMIZED_WRITER_COVER_TYPE
  blurDataUrl: string
}

export async function createWriterCoverBlurDataUrl(input: Buffer): Promise<string> {
  const blurOutput = await sharp(input)
    .resize({ width: WRITER_COVER_BLUR_WIDTH })
    .webp({ quality: WRITER_COVER_BLUR_QUALITY })
    .toBuffer()

  return `data:${OPTIMIZED_WRITER_COVER_TYPE};base64,${blurOutput.toString('base64')}`
}

function createR2Client() {
  if (
    !env.R2_ACCOUNT_ID
    || !env.R2_ACCESS_KEY_ID
    || !env.R2_SECRET_ACCESS_KEY
    || !env.R2_BUCKET_NAME
    || !env.R2_PUBLIC_URL
  ) {
    throw new Error('R2 configuration is incomplete')
  }

  return new S3Client({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET_NAME,
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  })
}

function parseIntegerOption(value: number | string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined

  const parsedValue = Number(value)
  if (!Number.isInteger(parsedValue)) return undefined

  return parsedValue
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function normalizeOptimizationOptions(options: WriterCoverOptimizationOptions = {}) {
  const quality = clamp(
    parseIntegerOption(options.quality) ?? DEFAULT_WRITER_COVER_QUALITY,
    1,
    100,
  )
  const width = clamp(
    parseIntegerOption(options.width) ?? DEFAULT_WRITER_COVER_WIDTH,
    1,
    4096,
  )
  const height = clamp(
    parseIntegerOption(options.height) ?? DEFAULT_WRITER_COVER_HEIGHT,
    1,
    4096,
  )

  return { quality, width, height }
}

export async function optimizeWriterCover(
  file: File,
  options?: WriterCoverOptimizationOptions,
): Promise<OptimizedWriterCover> {
  if (!SUPPORTED_WRITER_COVER_TYPES.has(file.type)) {
    throw new Error('Unsupported writer cover type')
  }

  const { quality, width, height } = normalizeOptimizationOptions(options)
  const input = Buffer.from(await file.arrayBuffer())
  const output = await sharp(input)
    .rotate()
    .resize({
      width,
      height,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality })
    .toBuffer()
  const blurDataUrl = await createWriterCoverBlurDataUrl(output)

  return {
    body: new Blob([output], { type: OPTIMIZED_WRITER_COVER_TYPE }),
    contentType: OPTIMIZED_WRITER_COVER_TYPE,
    blurDataUrl,
  }
}

export async function uploadPublicCover(
  file: File,
  keyPrefix: string,
  options?: WriterCoverOptimizationOptions,
) {
  const optimizedCover = await optimizeWriterCover(file, options)

  const key = `${keyPrefix}/${crypto.randomUUID()}.${OPTIMIZED_WRITER_COVER_EXTENSION}`
  const r2 = createR2Client()

  await r2.write(key, optimizedCover.body, { type: optimizedCover.contentType })

  return {
    key,
    cover_url: `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`,
    cover_blur_data_url: optimizedCover.blurDataUrl,
  }
}

export async function uploadWriterCover(
  file: File,
  options?: WriterCoverOptimizationOptions,
) {
  return uploadPublicCover(file, 'stories/covers', options)
}

export async function deleteWriterCover(key: string): Promise<void> {
  await createR2Client().delete(key)
}

export async function deleteWriterCoverByUrl(coverUrl: string): Promise<void> {
  const publicUrl = env.R2_PUBLIC_URL.replace(/\/$/, '')
  const prefix = `${publicUrl}/`
  if (!publicUrl || !coverUrl.startsWith(prefix)) return

  await deleteWriterCover(coverUrl.slice(prefix.length))
}
