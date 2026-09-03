import { StoryGrid } from '@/components/story-grid'

const LATEST_UPDATES = [
  {
    id: 1,
    title: 'คำสัญญาในคืนดาวตก',
    episode: 'ตอนที่ 12',
    author: 'ปลายปากกาสีคราม',
    updatedAt: '4 นาที',
    image: '/covers/cartoon-cover-01.png',
  },
  {
    id: 2,
    title: 'ฤดูร้อนที่เราพบกัน',
    episode: 'ตอนที่ 9',
    author: 'ดอกไม้ริมทาง',
    updatedAt: '21 นาที',
    image: '/covers/cartoon-cover-02.png',
  },
  {
    id: 3,
    title: 'บันทึกรักข้ามเวลา',
    episode: 'ตอนที่ 24',
    author: 'นักเดินทาง',
    updatedAt: '1 ชั่วโมง',
    image: '/covers/cartoon-cover-03.png',
  },
  {
    id: 4,
    title: 'เกิดใหม่ครั้งนี้ขอเป็นตัวเอง',
    episode: 'ตอนที่ 4',
    author: 'เมฆสีขาว',
    updatedAt: '2 ชั่วโมง',
    image: '/covers/cartoon-cover-04.png',
  },
  {
    id: 5,
    title: 'สาวข้างบ้านกับคุณชายเย็นชา',
    episode: 'ตอนที่ 82',
    author: 'ดวงดาวยามค่ำ',
    updatedAt: '3 ชั่วโมง',
    image: '/covers/cartoon-cover-05.png',
  },
  {
    id: 6,
    title: 'ตำนานผู้พิทักษ์แห่งแสง',
    episode: 'ตอนที่ 21',
    author: 'หมึกดำ',
    updatedAt: '6 ชั่วโมง',
    image: '/covers/cartoon-cover-06.png',
  },
  {
    id: 7,
    title: 'ซอมบี้ตัวน้อยกับหัวใจนักรบ',
    episode: 'ตอนที่ 1',
    author: 'ฟ้าหลังฝน',
    updatedAt: '11 ชั่วโมง',
    image: '/covers/cartoon-cover-07.png',
  },
  {
    id: 8,
    title: 'คุณหนูผู้ไม่ยอมแพ้',
    episode: 'ตอนที่ 81',
    author: 'รอยยิ้ม',
    updatedAt: '12 ชั่วโมง',
    image: '/covers/cartoon-cover-01.png',
  },
  {
    id: 9,
    title: 'ความฝันสีฟ้า',
    episode: 'ตอนที่ 7',
    author: 'ทะเลดาว',
    updatedAt: '12 ชั่วโมง',
    image: '/covers/cartoon-cover-02.png',
  },
  {
    id: 10,
    title: 'รถไฟเที่ยวสุดท้าย',
    episode: 'ตอนที่ 13',
    author: 'ปลายทาง',
    updatedAt: '13 ชั่วโมง',
    image: '/covers/cartoon-cover-03.png',
  },
  {
    id: 11,
    title: 'คนสุดท้ายที่ฉันคิดถึง',
    episode: 'ตอนที่ 8',
    author: 'พีโอนี',
    updatedAt: '14 ชั่วโมง',
    image: '/covers/cartoon-cover-04.png',
  },
  {
    id: 12,
    title: 'เสียงกระซิบจากเงามืด',
    episode: 'ตอนที่ 5',
    author: 'แสงจันทร์',
    updatedAt: '14 ชั่วโมง',
    image: '/covers/cartoon-cover-05.png',
  },
  {
    id: 13,
    title: 'ผู้กล้าแห่งหุบเขามังกร',
    episode: 'ตอนที่ 18',
    author: 'ดาบสีเงิน',
    updatedAt: '15 ชั่วโมง',
    image: '/covers/cartoon-cover-06.png',
  },
  {
    id: 14,
    title: 'รักแรกในร้านหนังสือ',
    episode: 'ตอนที่ 10',
    author: 'กระดาษสีครีม',
    updatedAt: '16 ชั่วโมง',
    image: '/covers/cartoon-cover-02.png',
  },
  {
    id: 15,
    title: 'จอมเวทฝึกหัดกับภารกิจลับ',
    episode: 'ตอนที่ 31',
    author: 'ไม้กายสิทธิ์',
    updatedAt: '17 ชั่วโมง',
    image: '/covers/cartoon-cover-03.png',
  },
  {
    id: 16,
    title: 'เมืองลับแลใต้แสงจันทร์',
    episode: 'ตอนที่ 20',
    author: 'คืนเดือนเพ็ญ',
    updatedAt: '18 ชั่วโมง',
    image: '/covers/cartoon-cover-04.png',
  },
  {
    id: 17,
    title: 'สูตรรักฉบับแม่มดน้อย',
    episode: 'ตอนที่ 14',
    author: 'ขนมหวาน',
    updatedAt: '19 ชั่วโมง',
    image: '/covers/cartoon-cover-05.png',
  },
  {
    id: 18,
    title: 'ปลายทางของดวงดาว',
    episode: 'ตอนที่ 27',
    author: 'กาแล็กซี',
    updatedAt: '20 ชั่วโมง',
    image: '/covers/cartoon-cover-07.png',
  },
] as const

export function LatestUpdatesSection() {
  return (
    <section
      aria-labelledby="latest-updates-heading"
      className="mt-8 rounded-3xl pt-8 pb-2 md:pt-10"
    >
      <h2 id="latest-updates-heading" className="mb-6 text-xl font-bold tracking-tight text-zinc-950 md:text-2xl">
        อัพเดตใหม่
      </h2>

      <StoryGrid
        eagerFirst
        stories={LATEST_UPDATES.map((item) => ({
          ...item,
          type: 'novel' as const,
          meta: `อัพเดตเมื่อ ${item.updatedAt}ที่แล้ว`,
        }))}
      />
    </section>
  )
}
