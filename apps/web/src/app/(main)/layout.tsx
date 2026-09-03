import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'

/**
 * app/(main)/layout.tsx
 *
 * Layout สำหรับหน้าทั่วไปที่มี Navbar
 * ครอบ: หน้าแรก, รายการนิยาย, รายละเอียด, อ่าน, โปรไฟล์, writer, admin
 *
 * ทำไมถึงใช้ Route Group (main)?
 * - เครื่องหมาย () ไม่มีผลต่อ URL — หน้าแรก / ยังคงเป็น / ไม่ใช่ /main
 * - แต่ทำให้เราแยก layout ได้ชัดเจน: (main) มี Navbar, (auth) ไม่มี
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    // 2026-08-18 มติแก้ (รอบสอง): user รายงาน gap ใต้ Footer จริงในหน้าเนื้อหาสั้นๆ (เช่น
    // /contact-admin) — รอบก่อนที่เคยพังทั้งเว็บ เกิดจากตอนนั้นให้ "main" เองเป็น `flex` container
    // ด้วย (ไม่ใช่แค่ flex-1) เพื่อ centering หน้า error สั้นๆ ไปพร้อมกัน — พอ main เป็น flex
    // container ลูกของมัน (div ของแต่ละหน้าที่ใช้ "mx-auto max-w-[...]") กลายเป็น flex item ไปด้วย
    // แล้ว margin auto ซ้าย-ขวาบน cross-axis (แนวตั้งของ flex-col) จะไปยกเลิก align-items:stretch
    // เริ่มต้นของตัวเอง ทำให้หดเหลือแค่ความกว้างเนื้อหาจริง ไม่เต็ม max-width — รอบนี้แก้เฉพาะจุด:
    // wrapper เป็น flex flex-col + main เป็นแค่ flex-1 เท่านั้น (ไม่ใส่ display:flex ให้ตัว main
    // เอง) ลูกของ main เลยยังอยู่ใน normal block flow เหมือนเดิมทุกอย่าง mx-auto จึงยังทำงานถูกต้อง
    // — ส่วนหน้า error สั้นๆ ที่อยากให้ข้อความอยู่กึ่งกลางแนวตั้ง ให้ทำแบบ self-contained ในหน้านั้นๆ
    // เอง (เช่น min-h-[Xvh] + flex items-center) แทนที่จะพึ่ง layout กลางนี้ เหมือนที่เคยสรุปไว้
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_50%_-10%,rgb(208_198_176_/_0.76),transparent_39rem)] bg-no-repeat">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}
