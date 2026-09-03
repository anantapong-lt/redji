/**
 * lib/referral-code.ts — จับ ?ref=CODE จาก URL แล้วเก็บไว้ prefill ตอนเปิด RedeemCodeDialog
 * (2026-08-18) — ใช้ window.location.search ตรงๆ แทน useSearchParams() ของ Next.js โดยตั้งใจ
 * เพราะ useSearchParams() ต้องห่อด้วย <Suspense> และโค้ดฐานนี้มีบั๊กจริงที่ยังไม่แก้ (หน้า /search,
 * /gallery ค้างที่ Suspense fallback ตลอดไปเมื่อใช้ hook นี้ — ดู KNOWN_ISSUES.md) เลี่ยงความเสี่ยง
 * เดียวกันโดยอ่าน query string ตรงๆ ฝั่ง client แทน ไม่ต้องพึ่ง Suspense เลย
 */

const STORAGE_KEY = 'pending_ref_code'

/** เรียกครั้งเดียวตอนแอปโหลด (Navbar mount ทุกหน้า) — ถ้ามี ?ref= ใน URL ปัจจุบันให้เก็บไว้ */
export function captureReferralCodeFromUrl() {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  const ref = params.get('ref')
  if (ref && ref.trim()) {
    localStorage.setItem(STORAGE_KEY, ref.trim())
  }
}

export function getPendingReferralCode(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY)
}

export function clearPendingReferralCode() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
