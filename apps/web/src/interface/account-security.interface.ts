export interface AccountSecurity {
  email: string
  email_verified: boolean
  has_password: boolean
  google_email: string | null
  google_linked_at: string | null
}

export interface ChangePasswordInput {
  current_password: string
  new_password: string
  confirm_password: string
}
