/**
 * cloudflare-placeholder.tsx — ตัวแทน Cloudflare Turnstile ชั่วคราว
 *
 * ยังไม่ได้ต่อ Turnstile จริง — ตอนต่อจริงให้เอา component นี้ออก
 * แล้วแทนที่ด้วย <Turnstile /> จาก @marsidev/react-turnstile หรือ script ของ Cloudflare โดยตรง
 * (ดู KNOWN_ISSUES.md)
 */
export function CloudflarePlaceholder() {
  return (
    <div className="flex h-16 w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
      cloudflare box
    </div>
  )
}
