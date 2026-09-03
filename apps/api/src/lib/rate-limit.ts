import { createHash } from 'node:crypto'
import Redis from 'ioredis'

/**
 * Redis-backed fixed-window limiter shared by API routes.
 *
 * Subjects are SHA-256 hashed before becoming part of a Redis key. This keeps
 * IP addresses, account IDs, emails, and login names out of Redis key names
 * and out of Redis monitoring/log output.
 */
export type RateLimitRule = {
  scope: string
  subject: string
  limit: number
  windowSeconds: number
  /**
   * Sensitive mutations must fail closed if Redis is unavailable. Broad
   * request limits may fail open so a Redis outage cannot take down reading.
   */
  onUnavailable?: 'allow' | 'deny'
}

export type RateLimitResult = {
  allowed: boolean
  retryAfterSeconds: number
  unavailable?: boolean
}

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
const KEY_TTL_GRACE_SECONDS = 60

let redis: Redis | null = null

function getRedis(): Redis {
  if (redis) return redis

  redis = new Redis(REDIS_URL, {
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    retryStrategy: (attempt) => Math.min(attempt * 100, 2_000),
  })
  redis.on('error', (error) => {
    console.error('[rate-limit] Redis unavailable:', error.message)
  })
  return redis
}

function currentWindow(windowSeconds: number): number {
  return Math.floor(Date.now() / 1_000 / windowSeconds)
}

function retryAfterSeconds(windowSeconds: number): number {
  return Math.max(
    1,
    windowSeconds - (Math.floor(Date.now() / 1_000) % windowSeconds),
  )
}

function makeKey(scope: string, subject: string, windowSeconds: number): string {
  const fingerprint = createHash('sha256').update(subject).digest('hex')
  return `readji:rate-limit:${scope}:${fingerprint}:${currentWindow(windowSeconds)}`
}

function validateRule(rule: RateLimitRule): void {
  if (!Number.isSafeInteger(rule.limit) || rule.limit < 1) {
    throw new Error(`Invalid rate-limit value for ${rule.scope}`)
  }
  if (!Number.isSafeInteger(rule.windowSeconds) || rule.windowSeconds < 1) {
    throw new Error(`Invalid rate-limit window for ${rule.scope}`)
  }
}

async function consume(rule: RateLimitRule): Promise<RateLimitResult> {
  validateRule(rule)

  // INCRBY + first-request EXPIRE must be atomic; otherwise two simultaneous
  // first requests can leave a counter without a TTL and permanently lock it.
  const count = Number(await getRedis().eval(
    `
      local count = redis.call('INCRBY', KEYS[1], ARGV[1])
      if count == tonumber(ARGV[1]) then
        redis.call('EXPIRE', KEYS[1], ARGV[2])
      end
      return count
    `,
    1,
    makeKey(rule.scope, rule.subject, rule.windowSeconds),
    '1',
    String(rule.windowSeconds + KEY_TTL_GRACE_SECONDS),
  ))

  return {
    allowed: count <= rule.limit,
    retryAfterSeconds: retryAfterSeconds(rule.windowSeconds),
  }
}

/** Checks every rule; the first exhausted rule rejects the request. */
export async function checkRateLimits(rules: RateLimitRule[]): Promise<RateLimitResult> {
  let longestRetryAfter = 1

  for (const rule of rules) {
    try {
      const result = await consume(rule)
      longestRetryAfter = Math.max(longestRetryAfter, result.retryAfterSeconds)
      if (!result.allowed) return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[rate-limit] ${rule.scope} check failed:`, message)
      if (rule.onUnavailable === 'allow') continue
      return { allowed: false, retryAfterSeconds: 60, unavailable: true }
    }
  }

  return { allowed: true, retryAfterSeconds: longestRetryAfter }
}

/**
 * The hosting proxy supplies one of these headers. Header text is only used as
 * a rate-limit subject and is hashed before storage, so malformed values do
 * not create uncontrolled Redis key contents.
 */
export function getClientIp(request: Request): string {
  const candidates = [
    request.headers.get('cf-connecting-ip'),
    request.headers.get('x-real-ip'),
    request.headers.get('x-forwarded-for')?.split(',')[0],
  ]
  const value = candidates.find((candidate) => candidate?.trim())?.trim()
  return value?.slice(0, 128) || 'unknown'
}

export function ipRateLimitRule(
  scope: string,
  request: Request,
  limit: number,
  windowSeconds: number,
  onUnavailable: RateLimitRule['onUnavailable'] = 'deny',
): RateLimitRule {
  return { scope, subject: `ip:${getClientIp(request)}`, limit, windowSeconds, onUnavailable }
}

export function accountRateLimitRule(
  scope: string,
  accountId: string | number | bigint,
  limit: number,
  windowSeconds: number,
  onUnavailable: RateLimitRule['onUnavailable'] = 'deny',
): RateLimitRule {
  return { scope, subject: `account:${String(accountId)}`, limit, windowSeconds, onUnavailable }
}

export function valueRateLimitRule(
  scope: string,
  value: string,
  limit: number,
  windowSeconds: number,
  onUnavailable: RateLimitRule['onUnavailable'] = 'deny',
): RateLimitRule {
  return { scope, subject: `value:${value.trim().toLocaleLowerCase()}`, limit, windowSeconds, onUnavailable }
}

/** Standard 429/503 response. Callers return this value immediately if present. */
export async function enforceRateLimit(
  set: any,
  rules: RateLimitRule[],
): Promise<{ success: false; message: string } | undefined> {
  const result = await checkRateLimits(rules)
  // Elysia treats null from onBeforeHandle as an early response. Use undefined
  // so root and route-level hooks continue to their intended handler.
  if (result.allowed) return undefined

  set.status = result.unavailable ? 503 : 429
  set.headers['retry-after'] = String(result.retryAfterSeconds)
  set.headers['cache-control'] = 'no-store'

  return {
    success: false,
    message: result.unavailable
      ? 'ระบบป้องกันคำขอไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง'
      : 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง',
  }
}
