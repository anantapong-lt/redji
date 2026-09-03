import type { AuthUser } from './user.interface'

export interface AuthSession {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  user: AuthUser
}
