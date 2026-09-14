import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import type { RandomWriterProfile } from '@/interface/profile.interface'

export function RisingAuthorsSection({ profiles }: { profiles: RandomWriterProfile[] }) {
  return (
    <aside aria-labelledby="rising-authors-heading" className="w-full">
      <div className="rounded-md bg-card p-4">
        <h2 id="rising-authors-heading" className="text-lg font-bold tracking-tight text-foreground">
          แนะนำนักเขียน
        </h2>
        <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>ค้นพบผลงานจากนักเขียนหลากหลายคน</p>
          <span className="shrink-0 text-[10px] font-medium">เรื่อง</span>
        </div>

        <ol className="mt-4 space-y-3">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <Link
                href={`/profile/${encodeURIComponent(profile.username)}`}
                className="group -mx-2 flex items-center gap-2.5 rounded-lg border border-transparent p-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/10 hover:shadow-sm"
              >
                <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-border bg-background">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="size-full object-cover transition-transform duration-200 group-hover:scale-110" />
                  ) : (
                    <span className="flex size-full items-center justify-center bg-primary text-xs font-bold text-primary-foreground">
                      {profile.display_name.trim().charAt(0) || profile.username.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <p className="truncate text-xs font-bold text-foreground transition-colors group-hover:text-primary">
                    {profile.display_name}
                  </p>
                  <p className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground"><BookOpen className="size-3" />{Number(profile.story_count).toLocaleString()}</p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  )
}
