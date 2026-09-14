import { createHash } from 'node:crypto'
import { db } from '../../db'
import { authenticateWithPassword, type AuthenticationResult } from './auth.service'

const WINDOW_MINUTES = 15
const MAX_FAILURES = 5

export class AgentLoginError extends Error {
  constructor(readonly statusCode: 401 | 403 | 429, message: string) {
    super(message)
    this.name = 'AgentLoginError'
  }
}

function limitKey(email: string, clientIp: string) {
  return createHash('sha256').update(`${email.trim().toLowerCase()}|${clientIp}`).digest('hex')
}

export async function authenticateAgentWithPassword(email: string, password: string, clientIp: string): Promise<AuthenticationResult> {
  const keyHash = limitKey(email, clientIp)
  const [limit] = await db<{ locked_until: Date | null }[]>`
    SELECT locked_until FROM tts_agent_login_limits WHERE key_hash = ${keyHash} LIMIT 1
  `
  if (limit?.locked_until && limit.locked_until > new Date()) {
    throw new AgentLoginError(429, 'Too many failed login attempts. Please try again later.')
  }

  const result = await authenticateWithPassword(email, password)
  if (result.status !== 'authenticated') {
    await db`
      INSERT INTO tts_agent_login_limits (key_hash, failed_attempts, window_started_at, locked_until)
      VALUES (${keyHash}, 1, NOW(), NULL)
      ON CONFLICT (key_hash) DO UPDATE SET
        failed_attempts = CASE
          WHEN tts_agent_login_limits.window_started_at < NOW() - (${WINDOW_MINUTES} * INTERVAL '1 minute') THEN 1
          ELSE tts_agent_login_limits.failed_attempts + 1 END,
        window_started_at = CASE
          WHEN tts_agent_login_limits.window_started_at < NOW() - (${WINDOW_MINUTES} * INTERVAL '1 minute') THEN NOW()
          ELSE tts_agent_login_limits.window_started_at END,
        locked_until = CASE
          WHEN tts_agent_login_limits.window_started_at >= NOW() - (${WINDOW_MINUTES} * INTERVAL '1 minute')
            AND tts_agent_login_limits.failed_attempts + 1 >= ${MAX_FAILURES}
          THEN NOW() + (${WINDOW_MINUTES} * INTERVAL '1 minute') ELSE NULL END,
        updated_at = NOW()
    `
    return result
  }

  await db`DELETE FROM tts_agent_login_limits WHERE key_hash = ${keyHash}`
  return result
}
