import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookOpenText, Eye, ShieldCheck, UserRound } from 'lucide-react'
import { getPublicContent } from '@/controllers/content.controller'
import { ApiError } from '@/lib/api-client'

const TYPE_LABELS = {
  novel: 'นิยาย',
  manga: 'การ์ตูน',
} as const

export default async function ContentPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  try {
    const { story } = await getPublicContent(slug)
    const genres = story.secondary_genre
      ? [story.primary_genre, story.secondary_genre]
      : [story.primary_genre]

    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:py-10 md:px-8 lg:py-14">
        <article className="readji-surface relative overflow-hidden rounded-[1.75rem]">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_18%_0%,color-mix(in_srgb,var(--primary)_20%,transparent),transparent_60%),linear-gradient(to_bottom,color-mix(in_srgb,var(--secondary)_72%,transparent),transparent)]"
          />
          <div
            aria-hidden="true"
            className="absolute right-[-4rem] top-[-5rem] size-52 rounded-full border-[2.5rem] border-primary/5"
          />

          <div className="relative grid gap-9 p-5 sm:p-8 lg:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)] lg:items-start lg:gap-14 lg:p-12">
            <div className="mx-auto w-full max-w-[19rem] lg:mx-0">
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-muted shadow-[0_28px_60px_-24px_rgb(45_29_32_/_0.65)] ring-1 ring-white/70">
                {story.cover_url ? (
                  <Image
                    src={story.cover_url}
                    alt={`ปกเรื่อง ${story.title}`}
                    fill
                    sizes="(min-width: 1024px) 304px, (min-width: 640px) 50vw, calc(100vw - 72px)"
                    quality={75}
                    priority
                    placeholder={story.cover_blur_data_url ? 'blur' : 'empty'}
                    blurDataURL={story.cover_blur_data_url ?? undefined}
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
                    <BookOpenText className="size-10 opacity-50" aria-hidden="true" />
                    <span className="text-sm">ยังไม่มีภาพปก</span>
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 lg:pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-sm">
                  {TYPE_LABELS[story.type]}
                </span>
                {genres.map((genre) => (
                  <span
                    key={genre.id}
                    className="rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-semibold text-muted-foreground backdrop-blur-sm"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>

              <h1 className="readji-page-title mt-5 line-clamp-2 text-3xl leading-[1.2] sm:text-4xl lg:text-5xl">
                {story.title}
              </h1>

              <Link
                href={`/profile/${encodeURIComponent(story.author.username)}`}
                className="group mt-6 flex w-fit items-center gap-3 rounded-xl p-1.5 pr-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground ring-1 ring-border/60 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <UserRound className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">เขียนโดย</p>
                  <p className="font-bold text-foreground transition-colors group-hover:text-primary">
                    {story.author.display_name}
                  </p>
                </div>
              </Link>

              <dl className="mt-8 grid grid-cols-2 gap-3 sm:max-w-xl">
                <div className="rounded-2xl border border-border/70 bg-card/65 p-4 backdrop-blur-sm">
                  <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Eye className="size-4 text-primary" aria-hidden="true" />
                    ยอดอ่าน
                  </dt>
                  <dd className="mt-2 text-xl font-extrabold tracking-tight text-foreground">
                    {Number(story.total_views).toLocaleString('th-TH')}
                  </dd>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card/65 p-4 backdrop-blur-sm">
                  <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                    เรตอายุ
                  </dt>
                  <dd className="mt-2 text-xl font-extrabold tracking-tight text-foreground">
                    {story.age_rating === null || story.age_rating === 0
                      ? 'ทั่วไป'
                      : `${story.age_rating}+`}
                  </dd>
                </div>
              </dl>

              <section className="mt-8 rounded-2xl border border-border/70 bg-background/55 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="h-6 w-1 rounded-full bg-primary" />
                  <h2 className="text-lg font-extrabold text-foreground">เรื่องย่อ</h2>
                </div>
                <p className="mt-4 whitespace-pre-line leading-7 text-muted-foreground">
                  {story.synopsis || 'ยังไม่มีเรื่องย่อ'}
                </p>
              </section>
            </div>
          </div>
        </article>
      </div>
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }
}
