import type { PublicMangaChapterPage } from '@/interface/content.interface'

export function MangaChapterContent({
  storyTitle,
  pages,
}: {
  storyTitle: string
  pages: PublicMangaChapterPage[]
}) {
  return (
    <article className="bg-card px-0 py-8 sm:px-8 sm:py-12">
      <p className="mb-8 px-4 text-center text-xs text-muted-foreground/60">
        เรื่อง: {storyTitle}
      </p>
      <div className="mx-auto flex max-w-3xl select-none flex-col" onCopy={(event) => event.preventDefault()}>
        {pages.map((page) => (
          <img
            key={page.id}
            src={page.image_url}
            alt={page.alt_text ?? `หน้า ${page.page_number}`}
            width={page.width ?? undefined}
            height={page.height ?? undefined}
            loading={page.page_number === 1 ? 'eager' : 'lazy'}
            draggable={false}
            className="h-auto w-full"
          />
        ))}
      </div>
    </article>
  )
}
