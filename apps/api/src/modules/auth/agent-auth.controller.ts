import { status } from 'elysia'
import { createAuthSession, findActiveUserById, validateAuthSession } from './auth.service'
import { AgentLoginError, authenticateAgentWithPassword } from './agent-auth.service'

type SignAccessToken = (claims: { sub: string; role: string; token_type: 'access' }) => Promise<string>
type SignRefreshToken = (claims: { sub: string; role: string; jti: string; sid: string; token_type: 'refresh' }) => Promise<string>
type VerifyRefreshToken = (token: string) => Promise<unknown>

function loginError(result: { status: string }) {
  if (result.status === 'inactive') return status(403, { message: 'This account is not active.' })
  if (result.status === 'unverified') return status(403, { message: 'Please verify your email before signing in.' })
  return status(401, { message: 'Invalid email or password.' })
}

async function issueAgentTokens(user: { id: string; role: string }, signAccess: SignAccessToken, signRefresh: SignRefreshToken) {
  const refreshTokenId = crypto.randomUUID()
  const sessionId = await createAuthSession(user.id, refreshTokenId)
  const claims = { sub: user.id, role: user.role }
  return {
    access_token: await signAccess({ ...claims, token_type: 'access' }),
    refresh_token: await signRefresh({ ...claims, jti: refreshTokenId, sid: sessionId, token_type: 'refresh' }),
    token_type: 'Bearer',
    expires_in: 15 * 60,
  }
}

export async function agentLoginResponse(
  body: { email: string; password: string }, clientIp: string, signAccess: SignAccessToken, signRefresh: SignRefreshToken,
) {
  try {
    const result = await authenticateAgentWithPassword(body.email, body.password, clientIp)
    if (result.status !== 'authenticated') return loginError(result)
    return { ...(await issueAgentTokens(result.user, signAccess, signRefresh)), user: result.user }
  } catch (error) {
    if (error instanceof AgentLoginError) return status(error.statusCode, { message: error.message })
    console.error('Agent login failed', error)
    return status(500, { message: 'Unable to sign in.' })
  }
}

export async function agentRefreshResponse(refreshToken: string, signAccess: SignAccessToken, verifyRefresh: VerifyRefreshToken) {
  const payload = await verifyRefresh(refreshToken) as Record<string, unknown> | false
  if (!payload || payload.token_type !== 'refresh' || typeof payload.sub !== 'string' || typeof payload.jti !== 'string' || typeof payload.sid !== 'string') {
    return status(401, { message: 'Session expired. Please sign in again.' })
  }
  if (!(await validateAuthSession(payload.sid, payload.sub, payload.jti))) {
    return status(401, { message: 'Session expired. Please sign in again.' })
  }
  const user = await findActiveUserById(payload.sub)
  if (!user) return status(401, { message: 'Session expired. Please sign in again.' })
  return { access_token: await signAccess({ sub: user.id, role: user.role, token_type: 'access' }), token_type: 'Bearer', expires_in: 15 * 60, user }
}
