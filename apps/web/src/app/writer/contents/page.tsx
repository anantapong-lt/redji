import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { WriterLayout } from '../home/components/writer-layout'

type ContentTab = 'novel' | 'cartoon'

interface WriterContentsPageProps {
  searchParams: Promise<{ tab?: string | string[] }>
}

const tabs = [
  { label: 'นิยาย', value: 'novel' },
  { label: 'การ์ตูน', value: 'cartoon' },
] as const

const mockContents = {
  novel: [
    {
      id: 'novel-1',
      title: 'เงาจันทร์เหนือบัลลังก์',
      sales: '1,284',
      chapters: '42',
      views: '98.6K',
      latestChapter: 'ตอนที่ 42',
      type: 'นิยาย',
      status: 'เผยแพร่',
      createdAt: '12 ส.ค. 2569',
    },
    {
      id: 'novel-2',
      title: 'สัญญารักในคืนฝน',
      sales: '742',
      chapters: '28',
      views: '54.2K',
      latestChapter: 'ตอนที่ 28',
      type: 'นิยาย',
      status: 'เผยแพร่',
      createdAt: '3 ก.ค. 2569',
    },
    {
      id: 'novel-3',
      title: 'การเดินทางของนักเวทฝึกหัด',
      sales: '0',
      chapters: '6',
      views: '1.8K',
      latestChapter: 'ตอนที่ 6',
      type: 'นิยาย',
      status: 'ฉบับร่าง',
      createdAt: '28 ส.ค. 2569',
    },
  ],
  cartoon: [
    {
      id: 'cartoon-1',
      title: 'ชมรมลับนักล่าฝัน',
      sales: '968',
      chapters: '35',
      views: '72.4K',
      latestChapter: 'ตอนที่ 35',
      type: 'การ์ตูน',
      status: 'เผยแพร่',
      createdAt: '19 มิ.ย. 2569',
    },
    {
      id: 'cartoon-2',
      title: 'แมวส้มพิทักษ์โลก',
      sales: '315',
      chapters: '18',
      views: '26.1K',
      latestChapter: 'ตอนที่ 18',
      type: 'การ์ตูน',
      status: 'เผยแพร่',
      createdAt: '7 ส.ค. 2569',
    },
    {
      id: 'cartoon-3',
      title: 'วันธรรมดาของจอมมาร',
      sales: '0',
      chapters: '4',
      views: '892',
      latestChapter: 'ตอนที่ 4',
      type: 'การ์ตูน',
      status: 'ฉบับร่าง',
      createdAt: '30 ส.ค. 2569',
    },
  ],
} as const

export default async function WriterContentsPage({ searchParams }: WriterContentsPageProps) {
  const params = await searchParams
  const activeTab: ContentTab = params.tab === 'cartoon' ? 'cartoon' : 'novel'
  const contents = mockContents[activeTab]

  return (
    <WriterLayout>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto">
          <div className="relative flex flex-col items-center gap-4 lg:min-h-14 lg:block">
            <nav
              className="readji-surface mx-auto flex w-fit rounded-2xl p-1.5"
              aria-label="ประเภทผลงาน"
              role="tablist"
            >
              {tabs.map(({ label, value }) => {
                const isActive = activeTab === value

                return (
                  <Link
                    key={value}
                    href={`/writer/contents/?tab=${value}`}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`writer-${value}-panel`}
                    className={`min-w-36 rounded-xl px-8 py-4 text-center text-base font-bold transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {label}
                  </Link>
                )
              })}
            </nav>

            <Link
              href={`/writer/contents/create?type=${activeTab}`}
              className="order-first flex min-h-12 self-end items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 lg:absolute lg:top-0 lg:right-0 lg:order-none"
            >
              <Plus className="size-4" strokeWidth={2} />
              สร้างเนื้อหาใหม่
            </Link>
          </div>

          <section className="readji-surface mt-6 rounded-2xl p-4" aria-label="ตัวกรองเนื้อหา">
            <label className="relative block">
              <span className="sr-only">ค้นหาเนื้อหา</span>
              <Search
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.8}
              />
              <input
                type="search"
                placeholder="ค้นหาชื่อเนื้อหา"
                className="h-11 w-full rounded-xl border border-border bg-background pr-4 pl-11 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </label>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2">
                <span className="block text-sm font-semibold">ประเภท</span>
                <select className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary">
                  <option>ทั้งหมด</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-semibold">สถานะ</span>
                <select className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary">
                  <option>ทั้งหมด</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-semibold">หมวดหมู่</span>
                <select className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary">
                  <option>ทั้งหมด</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="block text-sm font-semibold">เรทอายุ</span>
                <select className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary">
                  <option>ทั้งหมด</option>
                </select>
              </label>
            </div>
          </section>

          <section
            id={`writer-${activeTab}-panel`}
            role="tabpanel"
            aria-label={activeTab === 'novel' ? 'นิยาย' : 'การ์ตูน'}
            className="readji-surface mt-6 overflow-hidden rounded-2xl"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-5 py-4">ชื่อ</th>
                    <th className="px-4 py-4 text-right">ยอดขาย</th>
                    <th className="px-4 py-4 text-right">จำนวนตอน</th>
                    <th className="px-4 py-4 text-right">จำนวนเข้าชม</th>
                    <th className="px-4 py-4">ตอนล่าสุด</th>
                    <th className="px-4 py-4">ประเภท</th>
                    <th className="px-4 py-4">สถานะ</th>
                    <th className="px-4 py-4">วันที่สร้าง</th>
                    <th className="px-5 py-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {contents.map((content) => (
                    <tr key={content.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-5 py-4 font-semibold">{content.title}</td>
                      <td className="px-4 py-4 text-right tabular-nums">{content.sales}</td>
                      <td className="px-4 py-4 text-right tabular-nums">{content.chapters}</td>
                      <td className="px-4 py-4 text-right tabular-nums">{content.views}</td>
                      <td className="px-4 py-4">{content.latestChapter}</td>
                      <td className="px-4 py-4">{content.type}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            content.status === 'เผยแพร่'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {content.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">{content.createdAt}</td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent"
                        >
                          จัดการ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </WriterLayout>
  )
}
