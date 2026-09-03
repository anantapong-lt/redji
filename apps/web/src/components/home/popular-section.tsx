import { StoryGrid } from '@/components/story-grid'

const POPULAR_NOVELS = [
  { id: 1, title: 'จักรพรรดิเหนือบัลลังก์', episode: 'ตอนที่ 48', author: 'เมฆาพเนจร', reads: '1.8M อ่าน', image: '/covers/cartoon-cover-04.png' },
  { id: 2, title: 'ย้อนเวลามาเป็นคุณหนูใหญ่', episode: 'ตอนที่ 36', author: 'จันทร์กระจ่าง', reads: '1.5M อ่าน', image: '/covers/cartoon-cover-01.png' },
  { id: 3, title: 'ระบบลับของตัวประกอบ', episode: 'ตอนที่ 72', author: 'นักเล่าเงา', reads: '1.3M อ่าน', image: '/covers/cartoon-cover-06.png' },
  { id: 4, title: 'เมื่อผมตื่นมาในโลกเวทมนตร์', episode: 'ตอนที่ 55', author: 'ปากกาขนนก', reads: '980K อ่าน', image: '/covers/cartoon-cover-03.png' },
  { id: 5, title: 'รักวุ่นวายของนายเย็นชา', episode: 'ตอนที่ 29', author: 'สายลมอ่อน', reads: '864K อ่าน', image: '/covers/cartoon-cover-02.png' },
  { id: 6, title: 'ปรมาจารย์ดาบคนสุดท้าย', episode: 'ตอนที่ 90', author: 'หมึกสีชาด', reads: '790K อ่าน', image: '/covers/cartoon-cover-07.png' },
  { id: 7, title: 'ร้านอาหารต่างโลก', episode: 'ตอนที่ 41', author: 'ใบชา', reads: '735K อ่าน', image: '/covers/cartoon-cover-05.png' },
  { id: 8, title: 'เลขาคนใหม่ของท่านประธาน', episode: 'ตอนที่ 22', author: 'ดอกพุดซ้อน', reads: '690K อ่าน', image: '/covers/cartoon-cover-02.png' },
  { id: 9, title: 'คดีลับในคืนเดือนดับ', episode: 'ตอนที่ 17', author: 'ราตรีนิรันดร์', reads: '612K อ่าน', image: '/covers/cartoon-cover-03.png' },
  { id: 10, title: 'เจ้าหญิงแห่งนครลอยฟ้า', episode: 'ตอนที่ 63', author: 'ดาวเหนือ', reads: '580K อ่าน', image: '/covers/cartoon-cover-04.png' },
  { id: 11, title: 'ภารกิจพิชิตใจจอมมาร', episode: 'ตอนที่ 34', author: 'ลูกกวาด', reads: '524K อ่าน', image: '/covers/cartoon-cover-01.png' },
  { id: 12, title: 'ความลับของห้องหมายเลขสิบสาม', episode: 'ตอนที่ 26', author: 'อีกาดำ', reads: '498K อ่าน', image: '/covers/cartoon-cover-06.png' },
  { id: 13, title: 'ราชันมังกรหวนคืน', episode: 'ตอนที่ 68', author: 'ดาบคราม', reads: '472K อ่าน', image: '/covers/cartoon-cover-01.png' },
  { id: 14, title: 'สัญญารักใต้ต้นซากุระ', episode: 'ตอนที่ 32', author: 'กลีบดอกไม้', reads: '450K อ่าน', image: '/covers/cartoon-cover-02.png' },
  { id: 15, title: 'นักสืบแห่งนครเวทมนตร์', episode: 'ตอนที่ 44', author: 'แว่นขยาย', reads: '421K อ่าน', image: '/covers/cartoon-cover-03.png' },
  { id: 16, title: 'สงครามบัลลังก์ลอยฟ้า', episode: 'ตอนที่ 76', author: 'ปีกสีขาว', reads: '398K อ่าน', image: '/covers/cartoon-cover-04.png' },
  { id: 17, title: 'คาเฟ่ลับรับสมัครภูต', episode: 'ตอนที่ 19', author: 'น้ำตาลปั้น', reads: '376K อ่าน', image: '/covers/cartoon-cover-05.png' },
  { id: 18, title: 'นักบินคนสุดท้ายแห่งกาแล็กซี', episode: 'ตอนที่ 51', author: 'ดาวหาง', reads: '354K อ่าน', image: '/covers/cartoon-cover-07.png' },
] as const

export function PopularSection() {
  return (
    <section
      aria-labelledby="popular-heading"
      className="rounded-3xl py-8 md:py-10"
    >
      <h2 id="popular-heading" className="mb-6 text-xl font-bold tracking-tight text-zinc-950 md:text-2xl">
        ยอดนิยม
      </h2>

      <StoryGrid
        stories={POPULAR_NOVELS.map((item) => ({
          ...item,
          type: 'novel' as const,
          meta: item.reads,
        }))}
      />
    </section>
  )
}
