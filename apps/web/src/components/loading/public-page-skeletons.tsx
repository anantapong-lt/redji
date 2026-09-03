import { Skeleton } from '@/components/ui/skeleton'

const skeletonItems = (count: number) => Array.from({ length: count }, (_, index) => index)

export function NovelCardSkeleton() {
  return (
    <div className="w-[140px] shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-2 shadow-sm md:w-[186px]">
      <Skeleton className="h-[178px] w-[124px] rounded-xl md:h-[237px] md:w-[170px]" />
      <div className="space-y-2 px-1 pt-3 pb-1">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
        <div className="flex gap-1 pt-1">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-10 rounded-full" />
        </div>
        <Skeleton className="mt-3 h-px w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-3 w-7" />
          <Skeleton className="h-3 w-7" />
          <Skeleton className="h-3 w-7" />
        </div>
      </div>
    </div>
  )
}

export function HomeSectionSkeleton({ title }: { title: string }) {
  return (
    <section className="mx-auto mt-12 max-w-[1280px] px-4 md:px-8">
      <h2 className="readji-page-title mb-4 flex items-center gap-2 text-lg md:text-xl">
        <span className="h-5 w-1 rounded-full bg-primary/35" />
        {title}
      </h2>
      <div className="flex gap-4 overflow-hidden pt-3 pb-2 md:gap-5">
        {skeletonItems(6).map((item) => (
          <NovelCardSkeleton key={item} />
        ))}
      </div>
    </section>
  )
}

export function HeroCarouselSkeleton() {
  return (
    <section className="mt-4 w-full px-3">
      <Skeleton className="h-[170px] w-full rounded-2xl sm:h-[210px] md:h-[260px] lg:h-[300px] xl:h-[340px]" />
    </section>
  )
}

function RankingColumnSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm">
      <div className="bg-primary/20 px-5 py-4">
        <Skeleton className="h-5 w-32 bg-white/40" />
      </div>
      {skeletonItems(5).map((item) => (
        <div key={item} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-5 w-6" />
          <Skeleton className="h-[82px] w-16 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function RankingBoardSkeleton() {
  return (
    <section className="mx-auto mt-12 mb-20 max-w-[1280px] px-4 md:px-8">
      <div className="mb-5 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-primary/35" />
        <Skeleton className="h-6 w-56" />
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {skeletonItems(3).map((item) => (
          <RankingColumnSkeleton key={item} />
        ))}
      </div>
    </section>
  )
}

export function SearchResultCardSkeleton() {
  return (
    <div className="flex h-[256px] w-full gap-4 overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-2 shadow-[0_14px_28px_-22px_rgb(45_29_32_/_0.56)]">
      <Skeleton className="h-[240px] w-[187px] shrink-0 rounded-xl" />
      <div className="flex min-w-0 flex-1 flex-col py-2 pr-2">
        <Skeleton className="h-6 w-3/5" />
        <Skeleton className="mt-2 h-3 w-1/4" />
        <div className="mt-4 flex gap-1">
          <Skeleton className="h-6 w-14 rounded-md" />
          <Skeleton className="h-6 w-12 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>
        <div className="mt-3 space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
        <div className="mt-auto flex items-center gap-3 border-t border-primary/12 pt-3">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-8" />
          <Skeleton className="ml-auto h-3 w-12" />
        </div>
      </div>
    </div>
  )
}

export function WriterResultCardSkeleton() {
  return (
    <div className="flex w-full items-center gap-5 rounded-[25px] bg-card p-5 shadow-sm">
      <Skeleton className="size-20 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
      <div className="flex gap-5 rounded-xl border border-border px-5 py-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-8" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-8" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  )
}

export function WorkDetailSkeleton() {
  return (
    <div className="mx-auto flex max-w-[1216px] flex-col gap-8 px-4 py-10 sm:px-6">
      <section className="overflow-hidden rounded-[25px] border border-border bg-card">
        <div className="grid gap-6 p-6 sm:grid-cols-[220px_1fr] sm:p-8">
          <Skeleton className="h-[300px] w-full rounded-2xl sm:w-[220px]" />
          <div className="space-y-4 py-2">
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-4 w-1/4" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
        </div>
        <div className="space-y-3 border-t border-border px-8 py-16 sm:px-16">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-6">
        <Skeleton className="h-6 w-32" />
        <div className="mt-5 space-y-3">
          {skeletonItems(5).map((item) => (
            <Skeleton key={item} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </section>
    </div>
  )
}

export function ReaderSkeleton() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
      <article className="rounded-[25px] border border-border bg-card px-6 py-10 sm:px-12">
        <Skeleton className="mx-auto h-7 w-2/3" />
        <div className="mt-10 space-y-4">
          {skeletonItems(12).map((item) => (
            <Skeleton key={item} className={item % 4 === 3 ? 'h-4 w-4/5' : 'h-4 w-full'} />
          ))}
        </div>
      </article>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:px-8">
      <section className="rounded-[25px] border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Skeleton className="size-28 shrink-0 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </section>
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-4">
        <section className="space-y-4 rounded-2xl border border-border bg-card p-6 lg:col-span-3">
          <Skeleton className="h-6 w-40" />
          <div className="flex gap-4 overflow-hidden">
            {skeletonItems(4).map((item) => (
              <NovelCardSkeleton key={item} />
            ))}
          </div>
        </section>
        <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </section>
      </div>
    </div>
  )
}
