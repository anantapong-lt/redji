export enum userRole {
  USER = 'user',
  WRITER = 'writer',
  SUPER_ADMIN = 'super_admin',
}

export interface AuthUser {
  id: string
  email: string
  username: string
  display_name: string
  phone_number: string | null
  phone_verified: boolean
  avatar_url: string | null
  balance: string
  role: userRole
  status: 'active'
}
