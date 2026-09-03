/**
 * lib/parse-user-agent.ts — แปลง user_agent ดิบ (login_history.user_agent เก็บ raw string
 * ไม่ผ่าน parse เลยตั้งแต่ auth.routes.ts) เป็นข้อความอ่านง่าย "เบราว์เซอร์ บนระบบปฏิบัติการ"
 * ใช้ regex ธรรมดาแทนติดตั้ง library แยก (ua-parser-js ฯลฯ) — หน้าตั้งค่าต้องการแค่ browser/OS
 * คร่าวๆ ไม่ต้องแม่นระดับ version/engine
 */
export function parseUserAgent(ua: string | null): string {
  if (!ua) return 'ไม่ทราบอุปกรณ์'

  let os = 'ไม่ทราบระบบปฏิบัติการ'
  if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/Windows/i.test(ua)) os = 'Windows'
  else if (/Mac OS X/i.test(ua)) os = 'macOS'
  else if (/Linux/i.test(ua)) os = 'Linux'

  // ลำดับสำคัญ: Edge/Opera/Samsung Internet ทุกตัวมีคำว่า "Chrome"/"Safari" แฝงอยู่ใน UA ด้วย
  // ต้องเช็คตัวเฉพาะเจาะจงกว่าก่อนเสมอ ไม่งั้นจะถูกจับเป็น Chrome/Safari ผิดตัวไปหมด
  let browser = 'ไม่ทราบเบราว์เซอร์'
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera'
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet'
  else if (/CriOS/i.test(ua)) browser = 'Chrome'
  else if (/Chrome\//i.test(ua)) browser = 'Chrome'
  else if (/FxiOS|Firefox/i.test(ua)) browser = 'Firefox'
  else if (/Safari\//i.test(ua)) browser = 'Safari'

  return `${browser} บน ${os}`
}
