import Image from 'next/image'
import Link from 'next/link'

const WEEKLY_POPULAR = [
  { id: 1, title: 'จักรพรรดิเหนือบัลลังก์', author: 'เมฆาพเนจร', reads: '182K อ่าน', image: '/covers/cartoon-cover-04.png' },
  { id: 2, title: 'คำสัญญาในคืนดาวตก', author: 'ปลายปากกาสีคราม', reads: '164K อ่าน', image: '/covers/cartoon-cover-01.png' },
  { id: 3, title: 'ระบบลับของตัวประกอบ', author: 'นักเล่าเงา', reads: '151K อ่าน', image: '/covers/cartoon-cover-06.png' },
  { id: 4, title: 'รักวุ่นวายของนายเย็นชา', author: 'สายลมอ่อน', reads: '139K อ่าน', image: '/covers/cartoon-cover-02.png' },
  { id: 5, title: 'นักสืบแห่งนครเวทมนตร์', author: 'แว่นขยาย', reads: '126K อ่าน', image: '/covers/cartoon-cover-03.png' },
  { id: 6, title: 'ร้านอาหารต่างโลก', author: 'ใบชา', reads: '118K อ่าน', image: '/covers/cartoon-cover-05.png' },
  { id: 7, title: 'นักบินคนสุดท้ายแห่งกาแล็กซี', author: 'ดาวหาง', reads: '104K อ่าน', image: '/covers/cartoon-cover-07.png' },
  { id: 8, title: 'เจ้าหญิงแห่งนครลอยฟ้า', author: 'ดาวเหนือ', reads: '98K อ่าน', image: '/covers/cartoon-cover-04.png' },
] as const

export function WeeklyPopularSection() {
  return (
    <aside aria-labelledby="weekly-popular-heading" className="w-full">
      <div className="rounded-md bg-card p-4">
        <h2 id="weekly-popular-heading" className="text-lg font-bold tracking-tight text-foreground">
          ยอดนิยมประจำสัปดาห์
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">เรื่องที่ได้รับความนิยมในสัปดาห์นี้</p>

        <ol className="mt-4 space-y-3.5">
          {WEEKLY_POPULAR.slice(0, 5).map((story, index) => (
            <li key={story.id}>
              <Link href="/novel" className="group grid grid-cols-[1.5rem_2.25rem_minmax(0,1fr)] items-center gap-2">
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-xs font-black tabular-nums transition-colors ${
                    index === 0
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : index < 3
                        ? 'bg-secondary text-secondary-foreground'
                        : 'text-muted-foreground group-hover:text-primary'
                  }`}
                >
                  {index + 1}
                </span>
                <div className="relative aspect-[3/4] overflow-hidden rounded-sm">
                  <Image
                    src={story.image}
                    alt={`ปกเรื่อง ${story.title}`}
                    fill
                    sizes="36px"
                    quality={60}
                    loading="lazy"
                    className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-xs font-bold text-foreground transition-colors group-hover:text-primary">
                    {story.title}
                  </h3>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{story.author}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{story.reads}</p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  )
}
