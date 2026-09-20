export function StoryCardSkeleton() {
  return (
    <article aria-hidden="true" className="min-w-0 animate-pulse lg:h-full">
      <div className="min-w-0 overflow-hidden rounded-md border border-border/80 bg-card shadow-sm lg:h-full">
        <div className="aspect-[3/4] bg-muted-foreground/25" />
        <div className="p-3">
          <div className="h-5 rounded-sm bg-muted-foreground/25" />
          <div className="mt-1 h-4 w-3/4 rounded-sm bg-muted-foreground/25" />
          <div className="mt-1 flex h-[0.875rem] items-center justify-between gap-2">
            <div className="h-full w-1/2 rounded-sm bg-muted-foreground/25" />
            <div className="h-full w-10 rounded-sm bg-muted-foreground/25" />
          </div>
        </div>
      </div>
    </article>
  )
}
