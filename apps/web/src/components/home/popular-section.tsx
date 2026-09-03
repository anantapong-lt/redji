import { StoryCard } from '@/components/story-card'

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
] as const

export function PopularSection() {
  return (
    <section className="mx-auto max-w-[1280px] rounded-3xl px-4 py-8 md:px-8 md:py-10">
      <h2 className="mb-6 text-xl font-bold tracking-tight text-zinc-950 md:text-2xl">
        ยอดนิยม
      </h2>

      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-5">
        {POPULAR_NOVELS.map((item) => (
          <StoryCard
            key={item.id}
            title={item.title}
            image={item.image}
            episode={item.episode}
            author={item.author}
            meta={item.reads}
          />
        ))}
      </div>
    </section>
  )
}
