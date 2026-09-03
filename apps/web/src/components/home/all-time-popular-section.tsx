import Image from 'next/image'
import Link from 'next/link'
import { POPULAR_NOVELS } from '@/components/home/popular-section'

const ALL_TIME_POPULAR = POPULAR_NOVELS.slice(0, 5)

export function AllTimePopularSection() {
  return (
    <aside
      aria-labelledby="all-time-popular-heading"
      className="w-full"
    >
      <div className="rounded-md bg-card p-4">
        <h2 id="all-time-popular-heading" className="text-lg font-bold tracking-tight text-foreground">
          ยอดนิยมตลอดกาล
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">เรื่องยอดนิยมตลอดกาล</p>

        <ol className="mt-4 space-y-3.5">
          {ALL_TIME_POPULAR.map((story, index) => (
            <li key={story.id}>
              <Link
                href="/novel"
                className="group grid grid-cols-[1.5rem_2.25rem_minmax(0,1fr)] items-center gap-2"
              >
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-xs font-black tabular-nums transition-colors ${
                    index === 0
                      ? 'bg-primary text-white shadow-sm'
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
