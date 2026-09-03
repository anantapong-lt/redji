'use client'

import { useQuery } from '@tanstack/react-query'
import { Eye, Heart, Star, MessageCircle, Rows3, Coins } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { formatCount } from '@/lib/utils'

interface ApiWorkStats {
  view_count: number
  like_count: number
  bookmark_count: number
  comment_count: number
  episode_count: number
  sales: number
}

function StatTile({
  icon: Icon,
  iconClassName,
  label,
  value,
}: {
  icon: typeof Eye
  iconClassName: string
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-[15px] border border-border p-4 text-center">
      <Icon className={iconClassName} />
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

// popup สรุปสถิติผลงาน — เลือกทำเป็น modal แทนหน้าใหม่ เพราะข้อมูลที่มีอยู่แล้วในระบบพอ
// ทำสรุปสั้นๆ ได้เลย ไม่ต้องสร้างหน้าแยก (ถ้าจะขยายเป็นกราฟ/รายละเอียดเยอะทีหลังค่อยแยกหน้าจริงจัง)
export function WorkStatsDialog({
  workUuid,
  workTitle,
  open,
  onOpenChange,
}: {
  workUuid: string | null
  workTitle?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['writer', 'work', workUuid, 'stats'],
    queryFn: () => api.get<{ data: ApiWorkStats }>(`/writer/works/${workUuid}/stats`).then((res) => res.data),
    enabled: open && !!workUuid,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>สถิติผลงาน{workTitle ? ` — ${workTitle}` : ''}</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <StatTile icon={Eye} iconClassName="size-5 text-amber-500" label="ยอดวิว" value={formatCount(data.view_count)} />
            <StatTile icon={Heart} iconClassName="size-5 text-pink-500" label="หัวใจ" value={formatCount(data.like_count)} />
            <StatTile icon={Star} iconClassName="size-5 text-primary" label="ผู้ติดตามเรื่อง" value={formatCount(data.bookmark_count)} />
            <StatTile icon={MessageCircle} iconClassName="size-5 text-sky-500" label="คอมเม้น" value={formatCount(data.comment_count)} />
            <StatTile icon={Rows3} iconClassName="size-5 text-teal-500" label="จำนวนตอน" value={formatCount(data.episode_count)} />
            <StatTile icon={Coins} iconClassName="size-5 text-amber-600" label="ยอดขาย" value={data.sales.toLocaleString(undefined, { minimumFractionDigits: 2 })} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
