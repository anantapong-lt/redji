type PasswordStrength = {
  label: 'อ่อนมาก' | 'อ่อน' | 'พอใช้' | 'แข็งแรง'
  level: number
  hint: string
  color: string
}

const commonPasswords = new Set([
  'password', 'password123', '12345678', 'qwerty123', '123456789', 'abc12345', 'letmein', 'welcome',
])

function getPasswordStrength(password: string): PasswordStrength | null {
  if (!password) return null

  const normalized = password.toLowerCase()
  const hasSequentialChars = /(?:0123|1234|2345|3456|4567|5678|6789|7890|abcd|bcde|cdef|defg|qwer|wert|erty)/.test(normalized)
  const repeated = /^(.)\1+$/.test(password) || /(.)\1\1/.test(password)
  const common = commonPasswords.has(normalized)
  const variety = [/[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length
  let score = (password.length >= 8 ? 1 : 0) + (password.length >= 12 ? 1 : 0) + variety
  if (common || hasSequentialChars || repeated) score = Math.min(score, 1)

  if (score <= 1) return {
    label: 'อ่อนมาก', level: 1, color: 'bg-destructive',
    hint: common || hasSequentialChars || repeated ? 'หลีกเลี่ยงคำหรือรูปแบบที่เดาง่าย' : 'เพิ่มความยาวและผสมตัวอักษรหลายรูปแบบ',
  }
  if (score <= 3) return { label: 'อ่อน', level: 2, color: 'bg-orange-500', hint: 'เพิ่มตัวพิมพ์ใหญ่ ตัวเลข หรือสัญลักษณ์' }
  if (score <= 5) return { label: 'พอใช้', level: 3, color: 'bg-amber-500', hint: 'เพิ่มความยาวอีกเล็กน้อยเพื่อความปลอดภัย' }
  return { label: 'แข็งแรง', level: 4, color: 'bg-emerald-500', hint: 'รหัสผ่านมีความหลากหลายและเดายาก' }
}

export function PasswordStrengthIndicator({ password }: { password: string }) {
  const strength = getPasswordStrength(password)
  if (!strength) return null

  return (
    <div aria-live="polite" className="space-y-1.5 pt-0.5">
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => <span key={index} className={`h-1 flex-1 rounded-full ${index < strength.level ? strength.color : 'bg-muted'}`} />)}
      </div>
      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">ความปลอดภัย: {strength.label}</span> · {strength.hint}</p>
    </div>
  )
}
