import Link from 'next/link'

const POPULAR_TAGS = [
  'แฟนตาซี',
  'โรแมนซ์',
  'จีนโบราณ',
  'ระบบ',
  'เกิดใหม่',
  'วาย',
  'สืบสวน',
  'ไซไฟ',
  'เกมออนไลน์',
  'ดราม่า',
] as const

export function PopularTagsSection({ id = 'popular-tags', onNavigate }: { id?: string; onNavigate?: () => void }) {
  return (
    <aside id={id} aria-labelledby={`${id}-heading`} className="w-full scroll-mt-4">
      <div className="rounded-md bg-card p-4">
        <h2 id={`${id}-heading`} className="text-lg font-bold tracking-tight text-foreground">
          แท็กยอดนิยม
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">แท็กที่ผู้อ่านกำลังสนใจ</p>

        <ul className="mt-4 flex flex-wrap gap-2">
          {POPULAR_TAGS.map((tag) => (
            <li key={tag}>
              <Link
                href={`/?tag=${encodeURIComponent(tag)}`}
                onClick={onNavigate}
                className="inline-flex rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10 hover:text-primary hover:shadow-sm"
              >
                #{tag}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
