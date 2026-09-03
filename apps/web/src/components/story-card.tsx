import Image from 'next/image'

export interface StoryCardProps {
  title: string
  image: string
  episode: string
  author: string
  meta: string
}

export function StoryCard({ title, image, episode, author, meta }: StoryCardProps) {
  return (
    <article className="min-w-0">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl">
        <Image
          src={image}
          alt={`ปกเรื่อง ${title}`}
          fill
          sizes="(min-width: 1024px) 186px, (min-width: 640px) 30vw, 46vw"
          className="object-cover"
        />
        <span className="absolute bottom-2 left-2 rounded-md bg-zinc-950/75 px-2 py-1 text-[11px] font-semibold text-white">
          {episode}
        </span>
      </div>

      <h3 className="mt-3 line-clamp-2 text-sm font-bold leading-5 text-zinc-950">
        {title}
      </h3>
      <p className="mt-1 truncate text-xs text-zinc-500">{author}</p>
      <p className="mt-1 text-[11px] text-zinc-400">{meta}</p>
    </article>
  )
}
