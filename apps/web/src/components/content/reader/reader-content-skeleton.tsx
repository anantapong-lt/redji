import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const LINE_WIDTHS = [
  'w-24',
  'w-16',
  'w-full',
  'w-11/12',
  'w-full',
  'w-4/5',
  'w-full',
  'w-10/12',
  'w-full',
  'w-3/4',
] as const

export function ReaderContentSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="กำลังโหลดเนื้อหา"
      className={cn('mx-auto max-w-3xl space-y-4', className)}
    >
      {LINE_WIDTHS.map((width, index) => (
        <Skeleton
          key={`${width}-${index}`}
          className={cn(
            'h-4 bg-current opacity-10',
            width,
            index === 1 || index === 5 ? 'mb-10' : null,
          )}
        />
      ))}
      <span className="sr-only">กำลังโหลดเนื้อหา</span>
    </div>
  )
}
