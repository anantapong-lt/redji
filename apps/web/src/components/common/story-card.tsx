'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

export interface StoryCardProps {
  slug: string
  title: string
  image: string
  blurDataUrl?: string | null
  episode: string
  author: string
  meta: string
  type: 'novel' | 'manga'
  eager?: boolean
}

export function StoryCard({
  slug,
  title,
  image,
  blurDataUrl,
  episode,
  author,
  meta,
  type,
  eager = false,
}: StoryCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const href = `/content/${encodeURIComponent(slug)}`

  return (
    <article className="min-w-0">
      <Link href={href} className="group block min-w-0 cursor-pointer" aria-label={`อ่าน ${title}`}>
        <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-muted-foreground/25">
          <div
            aria-hidden="true"
            className={`absolute inset-0 scale-110 bg-cover bg-center transition-opacity duration-300 ${
              imageLoaded ? 'opacity-0' : 'opacity-100'
            }`}
            style={blurDataUrl ? { backgroundImage: `url(${blurDataUrl})` } : undefined}
          />
          <Image
            src={image}
            alt={`ปกเรื่อง ${title}`}
            fill
            sizes="(min-width: 1536px) 147px, (min-width: 1024px) 180px, calc((100vw - 56px) / 4)"
            quality={60}
            preload={eager}
            loading={eager ? undefined : 'lazy'}
            fetchPriority={eager ? 'high' : undefined}
            onLoad={() => setImageLoaded(true)}
            className={`object-cover transition-[opacity,transform] duration-300 ease-out group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <span className="absolute bottom-2 left-2 rounded-md bg-zinc-950/75 px-1.5 py-0.5 text-[9px] font-semibold text-white lg:px-2 lg:py-1 lg:text-[11px]">
            {episode}
          </span>
        </div>

        <h3 className="mt-3 truncate text-sm font-bold leading-5 text-zinc-950 transition-colors duration-300 group-hover:text-primary">
          {title}
        </h3>
        <p className="mt-1 truncate text-xs leading-4 text-zinc-500">{author}</p>
        <p className="mt-1 truncate text-[11px] leading-[0.875rem] text-zinc-400">{meta}</p>
      </Link>
    </article>
  )
}
