'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatEpisodeTitle } from '@/lib/episode-format'
import type { EpisodeToc } from '@/lib/mock-work-detail'

export function EpisodeSelectDropdown({
  episodes,
  currentEpNo,
  onNavigate,
}: {
  episodes: EpisodeToc[]
  currentEpNo: number
  onNavigate: (epNo: number) => void
}) {
  const sorted = [...episodes].sort((a, b) => a.ep_no - b.ep_no)

  return (
    <div className="flex justify-center">
      <Select value={String(currentEpNo)} onValueChange={(epNo) => onNavigate(Number(epNo))}>
        <SelectTrigger className="h-10 rounded-full border-primary bg-card px-4 text-sm text-primary">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sorted.map((ep) => (
            <SelectItem key={ep.ep_id} value={String(ep.ep_no)}>
              {formatEpisodeTitle(ep.ep_no, ep.episode_label, ep.ep_name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
