export const USER_ROLES = ['user', 'admin', 'super_admin'] as const
export const USER_STATUSES = ['active', 'suspended', 'banned'] as const

export type UserRole = (typeof USER_ROLES)[number]
export type UserStatus = (typeof USER_STATUSES)[number]

export interface UserModel {
  id: string
  email: string
  username: string
  display_name: string
  phone_number: string | null
  avatar_url: string | null
  role: UserRole
  status: UserStatus
  email_verified_at: Date | null
  phone_verified_at: Date | null
  last_login_at: Date | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}
