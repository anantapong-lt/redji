import { RedisClient } from 'bun'
import { env } from '../config/env'

export const cache = new RedisClient(env.REDIS_URL, {
  connectionTimeout: 1_000,
  enableOfflineQueue: false,
  maxRetries: 1,
})
