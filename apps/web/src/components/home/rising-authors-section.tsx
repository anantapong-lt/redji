import Image from 'next/image'
import Link from 'next/link'
import { POPULAR_NOVELS } from '@/components/home/popular-section'

const RISING_AUTHORS = POPULAR_NOVELS.slice(0, 5)

export function RisingAuthorsSection() {
  return (
    <aside aria-labelledby="rising-authors-heading" className="w-full">
      <div className="rounded-md bg-card p-4">
        <h2 id="rising-authors-heading" className="text-lg font-bold tracking-tight text-foreground">
          นักเขียนมาแรง
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">นักเขียนที่กำลังได้รับความสนใจ</p>

        <ol className="mt-4 space-y-3">
          {RISING_AUTHORS.map((story, index) => (
            <li key={story.id}>
              <Link
                href={`/author/${story.id}`}
                className="group -mx-2 flex items-center gap-2.5 rounded-lg border border-transparent p-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/10 hover:shadow-sm"
              >
                <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-border bg-background">
                  <Image
                    src="/placeholder-user.jpg"
                    alt={`รูปโปรไฟล์ของ ${story.author}`}
                    fill
                    sizes="36px"
                    className="object-cover transition-transform duration-200 group-hover:scale-110"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-foreground transition-colors group-hover:text-primary">
                    {story.author}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{story.title}</p>
                </div>
                <span className="text-xs font-bold tabular-nums text-muted-foreground transition-colors group-hover:text-primary">
                  {index + 1}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  )
}
