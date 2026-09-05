import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { BookOpenText, Clock3, Eye, ListOrdered, ShieldCheck, UserRound } from 'lucide-react'
import { ShareButtons } from '@/components/common/share-buttons'
import { PublicChapterList } from '@/components/content/public-chapter-list'
import { FavoriteButton } from '@/components/content/favorite-button'
import { StoryRating } from '@/components/content/story-rating'
import { getPublicContent } from '@/controllers/content.controller'
import { ApiError } from '@/lib/api-client'
import {
  createContentMetadata,
  createContentStructuredData,
} from '@/utils/content-metadata.util'

interface ContentPageProps {
  params: Promise<{ slug: string }>
}

function formatChapterNumber(value: string) {
  return Number(value).toLocaleString('th-TH', { maximumFractionDigits: 1 })
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export async function generateMetadata({ params }: ContentPageProps): Promise<Metadata> {
  const { slug } = await params

  try {
    const { story } = await getPublicContent(slug)
    return createContentMetadata(story)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return {
        title: 'ไม่พบเรื่อง',
        robots: { index: false, follow: false },
      }
    }

    throw error
  }
}

export default async function ContentPage({ params }: ContentPageProps) {
  const { slug } = await params

  try {
    const cookieHeader = (await cookies()).toString()
    const { story, chapters: initialChapters } = await getPublicContent(slug, cookieHeader)
    const structuredData = createContentStructuredData(story, initialChapters.chapters)
    const ageRatingLabel = story.age_rating === null || story.age_rating === 0
      ? 'ทั่วไป'
      : `${story.age_rating}+`

    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-5 md:px-8 md:py-7 lg:py-9">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
          }}
        />
        <article className="readji-surface relative overflow-hidden rounded-[1.75rem]">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_18%_0%,color-mix(in_srgb,var(--primary)_20%,transparent),transparent_60%),linear-gradient(to_bottom,color-mix(in_srgb,var(--secondary)_72%,transparent),transparent)]"
          />
          <div
            aria-hidden="true"
            className="absolute right-[-4rem] top-[-5rem] size-52 rounded-full border-[2.5rem] border-primary/5"
          />

          <div className="relative grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)] lg:items-start lg:gap-9 lg:p-8">
            <div className="mx-auto w-full max-w-[19rem] lg:mx-0">
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-muted shadow-[0_28px_60px_-24px_rgb(45_29_32_/_0.65)] ring-1 ring-white/70">
                {story.cover_url ? (
                  <Image
                    src={story.cover_url}
                    alt={`ปกเรื่อง ${story.title}`}
                    fill
                    sizes="(max-width: 367px) calc(100vw - 64px), 304px"
                    quality={60}
                    preload
                    fetchPriority="high"
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
              <div className="mt-3 flex flex-wrap justify-center gap-2 lg:justify-start">
                <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/75 py-1.5 pr-3 pl-2 text-xs shadow-sm backdrop-blur-sm">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Eye className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="text-muted-foreground">ยอดอ่าน</span>
                  <span className="font-extrabold tabular-nums text-foreground">
                    {Number(story.total_views).toLocaleString('th-TH')}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/75 py-1.5 pr-3 pl-2 text-xs shadow-sm backdrop-blur-sm">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ListOrdered className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="text-muted-foreground">ทั้งหมด</span>
                  <span className="font-extrabold tabular-nums text-foreground">
                    {Number(story.chapter_count).toLocaleString('th-TH')} ตอน
                  </span>
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
                  {story.primary_genre.name}
                </span>
                {story.secondary_genre ? (
                  <span
                    className="rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-semibold text-muted-foreground backdrop-blur-sm"
                  >
                   {story.secondary_genre.name}
                  </span>
                ) : null}
                <span className="flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                  เรต {ageRatingLabel}
                </span>
              </div>

              <h1 className="readji-page-title mt-4 line-clamp-2 text-3xl leading-[1.2] sm:text-4xl lg:text-5xl">
                {story.title}
              </h1>

              <Link
                href={`/profile/${encodeURIComponent(story.author.username)}`}
                className="group mt-4 flex w-fit items-center gap-3 rounded-xl p-1.5 pr-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/30"
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

              {story.latest_chapter ? (
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5 text-primary" aria-hidden="true" />
                  อัปเดตล่าสุด {formatDate(story.latest_chapter.published_at)}
                  <span aria-hidden="true">·</span>
                  ตอนที่ {formatChapterNumber(story.latest_chapter.chapter_number)}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <FavoriteButton
                  slug={story.slug}
                  initialCount={Number(story.favorite_count)}
                  initialIsFavorited={story.is_favorited}
                />
                <ShareButtons title={story.title} />
                <StoryRating
                  slug={story.slug}
                  initialAverage={Number(story.rating_average)}
                  initialCount={Number(story.rating_count)}
                  initialUserRating={story.user_rating}
                />
              </div>

              <section className="mt-6 rounded-2xl border  p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-extrabold text-foreground">เรื่องย่อ</h2>
                </div>
                <p className="mt-4 whitespace-pre-line leading-7 text-muted-foreground">
                  {story.synopsis || 'ยังไม่มีเรื่องย่อ'}
                </p>
              </section>

            </div>
          </div>
        </article>
        <PublicChapterList
          slug={story.slug}
          storyTitle={story.title}
          coverUrl={story.cover_url}
          initialData={initialChapters}
          renderedAt={Date.now()}
        />
      </div>
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }
}
