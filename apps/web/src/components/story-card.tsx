import Image from 'next/image'
import Link from 'next/link'

export interface StoryCardProps {
  title: string
  image: string
  episode: string
  author: string
  meta: string
  type: 'novel' | 'manga'
  eager?: boolean
}

export function StoryCard({
  title,
  image,
  episode,
  author,
  meta,
  type,
  eager = false,
}: StoryCardProps) {
  const href = type === 'manga' ? '/manga' : '/novel'

  return (
    <article className="min-w-0">
      <Link href={href} className="group block min-w-0 cursor-pointer" aria-label={`อ่าน ${title}`}>
        <div className="relative aspect-[3/4] overflow-hidden rounded-sm">
          <Image
            src={image}
            alt={`ปกเรื่อง ${title}`}
            fill
            sizes="(min-width: 1024px) 186px, 22vw"
            quality={70}
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : 'auto'}
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />
          <span className="absolute bottom-2 left-2 rounded-md bg-zinc-950/75 px-1.5 py-0.5 text-[9px] font-semibold text-white lg:px-2 lg:py-1 lg:text-[11px]">
            {episode}
          </span>
        </div>

        <h3 className="mt-3 truncate text-sm font-bold leading-5 text-zinc-950 transition-colors duration-300 group-hover:text-primary">
          {title}
        </h3>
        <p className="mt-1 truncate text-xs text-zinc-500">{author}</p>
        <p className="mt-1 truncate text-[11px] text-zinc-400">{meta}</p>
      </Link>
    </article>
  )
}
