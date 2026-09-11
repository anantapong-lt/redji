export const USER_ROLE = {
  USER: 'user',
  WRITER: 'writer',
  SUPER_ADMIN: 'super_admin',
} as const

export const USER_STATUS = {
  ACTIVE: 'active',
  BANNED: 'banned',
} as const

export const USER_ROLES = Object.values(USER_ROLE)
export const USER_STATUSES = [USER_STATUS.ACTIVE, USER_STATUS.BANNED] as const

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE]
export type UserStatus = (typeof USER_STATUSES)[number]

export interface UserModel {
  id: string
  email: string
  username: string
  display_name: string
  phone_number: string | null
  avatar_url: string | null
  balance: string
  role: UserRole
  status: UserStatus
  email_verified_at: Date | null
  phone_verified_at: Date | null
  last_login_at: Date | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}
