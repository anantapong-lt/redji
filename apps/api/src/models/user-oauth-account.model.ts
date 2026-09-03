export const OAUTH_PROVIDERS = ['google'] as const

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number]

export interface UserOAuthAccountModel {
  id: string
  user_id: string
  provider: OAuthProvider
  provider_account_id: string
  provider_email: string | null
  created_at: Date
  updated_at: Date
}
