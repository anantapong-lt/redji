export function StoryCardSkeleton() {
  return (
    <article aria-hidden="true" className="min-w-0 animate-pulse">
      <div className="aspect-[3/4] rounded-sm bg-muted-foreground/25" />
      <div className="mt-3 h-5 rounded-sm bg-muted-foreground/25" />
      <div className="mt-1 h-4 w-3/4 rounded-sm bg-muted-foreground/25" />
      <div className="mt-1 h-[0.875rem] w-1/2 rounded-sm bg-muted-foreground/25" />
    </article>
  )
}
