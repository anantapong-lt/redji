export interface AccountSecurity {
  email: string
  email_verified: boolean
  phone_number: string | null
  phone_verified: boolean
  pending_phone_number: string | null
  has_password: boolean
  google_email: string | null
  google_linked_at: string | null
}

export interface PhoneVerificationInput {
  phone_number: string
  otp?: string
}

export interface ChangePasswordInput {
  current_password: string
  new_password: string
  confirm_password: string
}

export interface SetPasswordInput {
  new_password: string
  confirm_password: string
}
