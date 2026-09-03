import { StoryCard } from '@/components/story-card'

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
] as const

export function LatestUpdatesSection() {
  return (
    <section className="mx-auto mt-8 max-w-[1280px] rounded-3xl px-4 py-8 md:px-8 md:py-10">
      <h2 className="mb-6 text-xl font-bold tracking-tight text-zinc-950 md:text-2xl">
        อัพเดตใหม่
      </h2>

      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-5">
        {LATEST_UPDATES.map((item) => (
          <StoryCard
            key={item.id}
            title={item.title}
            image={item.image}
            episode={item.episode}
            author={item.author}
            meta={`อัพเดตเมื่อ ${item.updatedAt}ที่แล้ว`}
          />
        ))}
      </div>
    </section>
  )
}
