import Redis from 'ioredis'

type LimitRule = {
  limit: number
  windowSeconds: number
  scope: string
}

export type UploadLimitResult = {
  allowed: boolean
  retryAfterSeconds: number
  unavailable?: boolean
}

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

// These are deliberately conservative for a closed beta. They can be tuned
// through environment variables without changing code when production traffic
// is known.
const REQUESTS_PER_ACCOUNT_PER_HOUR = readPositiveInt(
  process.env.UPLOAD_REQUESTS_PER_ACCOUNT_PER_HOUR,
  20,
)
const REQUESTS_PER_IP_PER_HOUR = readPositiveInt(
  process.env.UPLOAD_REQUESTS_PER_IP_PER_HOUR,
  60,
)
const MANGA_IMAGES_PER_ACCOUNT_PER_DAY = readPositiveInt(
  process.env.MANGA_IMAGES_PER_ACCOUNT_PER_DAY,
  500,
)
const MANGA_IMAGES_PER_IP_PER_DAY = readPositiveInt(
  process.env.MANGA_IMAGES_PER_IP_PER_DAY,
  1_000,
)

let redis: Redis | null = null

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function getRedis(): Redis {
  if (redis) return redis

  redis = new Redis(REDIS_URL, {
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    retryStrategy: (attempt) => Math.min(attempt * 100, 2_000),
  })
  redis.on('error', (error) => {
    console.error('[upload-rate-limit] Redis unavailable:', error.message)
  })
  return redis
}

function getClientIp(request: Request): string {
  const candidates = [
    request.headers.get('cf-connecting-ip'),
    request.headers.get('x-real-ip'),
    request.headers.get('x-forwarded-for')?.split(',')[0],
  ]

  const value = candidates.find((candidate) => candidate?.trim())?.trim()
  // Never use raw header content in a Redis key. A malformed/spoofed value is
  // still bounded and only creates a separate rate-limit bucket.
  return value?.slice(0, 128) || 'unknown'
}

function currentWindow(windowSeconds: number): number {
  return Math.floor(Date.now() / 1_000 / windowSeconds)
}

function unavailable(error: unknown): UploadLimitResult {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[upload-rate-limit] Redis check failed:', message)
  return { allowed: false, retryAfterSeconds: 60, unavailable: true }
}

async function consume(
  subject: string,
  rule: LimitRule,
  cost: number,
): Promise<UploadLimitResult> {
  const key = `readji:rate-limit:uploads:${rule.scope}:${subject}:${currentWindow(rule.windowSeconds)}`
  const client = getRedis()
  const count = await client.incrby(key, cost)

  if (count === cost) {
    await client.expire(key, rule.windowSeconds + 60)
  }

  const retryAfterSeconds = Math.max(
    1,
    rule.windowSeconds - (Math.floor(Date.now() / 1_000) % rule.windowSeconds),
  )

  return {
    allowed: count <= rule.limit,
    retryAfterSeconds,
  }
}

/**
 * Limits every multipart upload before its body is parsed or written to R2.
 * Redis unavailability intentionally fails closed: losing uploads temporarily
 * is safer than allowing an unbounded R2 write path.
 */
export async function checkMultipartUploadLimit(
  request: Request,
  accountId: string,
): Promise<UploadLimitResult> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  try {
    const accountResult = await consume(accountId, {
      scope: 'account-request',
      limit: REQUESTS_PER_ACCOUNT_PER_HOUR,
      windowSeconds: 60 * 60,
    }, 1)
    if (!accountResult.allowed) return accountResult

    return consume(getClientIp(request), {
      scope: 'ip-request',
      limit: REQUESTS_PER_IP_PER_HOUR,
      windowSeconds: 60 * 60,
    }, 1)
  } catch (error) {
    return unavailable(error)
  }
}

/** Counts image objects, not HTTP requests, for manga batch uploads. */
export async function checkMangaImageUploadLimit(
  request: Request,
  accountId: string,
  imageCount: number,
): Promise<UploadLimitResult> {
  if (!Number.isSafeInteger(imageCount) || imageCount < 1) {
    return { allowed: false, retryAfterSeconds: 24 * 60 * 60 }
  }

  try {
    const accountResult = await consume(accountId, {
      scope: 'account-manga-images',
      limit: MANGA_IMAGES_PER_ACCOUNT_PER_DAY,
      windowSeconds: 24 * 60 * 60,
    }, imageCount)
    if (!accountResult.allowed) return accountResult

    return consume(getClientIp(request), {
      scope: 'ip-manga-images',
      limit: MANGA_IMAGES_PER_IP_PER_DAY,
      windowSeconds: 24 * 60 * 60,
    }, imageCount)
  } catch (error) {
    return unavailable(error)
  }
}
