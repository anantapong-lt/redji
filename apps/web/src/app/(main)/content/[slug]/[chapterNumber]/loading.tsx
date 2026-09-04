import { ReaderContentSkeleton } from '@/components/content/reader/reader-content-skeleton'

export default function LoadingChapter() {
  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-8">
      <section className="readji-surface overflow-hidden rounded-2xl sm:rounded-[1.75rem]">
        <div className="bg-card px-4 py-8 sm:px-10 sm:py-12 lg:px-16">
          <ReaderContentSkeleton />
        </div>
      </section>
    </div>
  )
}
