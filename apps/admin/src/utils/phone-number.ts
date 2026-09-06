export function formatPhoneNumber(value: string | null) {
  return value?.startsWith('+66') ? `0${value.slice(3)}` : value ?? ''
}
