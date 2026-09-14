'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { LoginRequiredDialog } from '@/components/auth/login-required-dialog'
import { ratePublicContent } from '@/controllers/content.controller'

function formatRating(value: number) {
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

export function StoryRating({
  slug,
  initialAverage,
  initialCount,
  initialUserRating,
}: {
  slug: string
  initialAverage: number
  initialCount: number
  initialUserRating: number | null
}) {
  const { accessToken, status } = useAuth()
  const [average, setAverage] = useState(initialAverage)
  const [count, setCount] = useState(initialCount)
  const [userRating, setUserRating] = useState(initialUserRating)
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isLoginRequiredDialogOpen, setIsLoginRequiredDialogOpen] = useState(false)
  const activeRating = hoveredRating ?? userRating ?? 0

  async function submitRating(rating: number) {
    if (status !== 'authenticated' || !accessToken) {
      setIsLoginRequiredDialogOpen(true)
      return
    }
    if (isUpdating) return

    setIsUpdating(true)
    try {
      const result = await ratePublicContent(slug, rating, accessToken)
      setUserRating(result.user_rating)
      setAverage(result.rating_average)
      setCount(result.rating_count)
    } catch {
      // Keep the last confirmed rating when the request fails.
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3">
      <div
        className="flex items-center gap-0.5"
        role="group"
        aria-label="ให้คะแนนเรื่องนี้"
        onMouseLeave={() => setHoveredRating(null)}
      >
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            disabled={isUpdating || status === 'loading'}
            onMouseEnter={() => setHoveredRating(rating)}
            onFocus={() => setHoveredRating(rating)}
            onBlur={() => setHoveredRating(null)}
            onClick={() => void submitRating(rating)}
            aria-label={`ให้คะแนน ${rating} ดาว`}
            aria-pressed={userRating === rating}
            className="cursor-pointer rounded-sm text-amber-400 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
          >
            <Star
              className={`size-4 ${rating <= activeRating ? 'fill-current' : 'text-muted-foreground/45'}`}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <span className="text-xs font-bold tabular-nums text-foreground" aria-live="polite">
        {formatRating(average)}
        <span className="ml-1 font-medium text-muted-foreground">
          ({count.toLocaleString('th-TH')})
        </span>
      </span>
      <LoginRequiredDialog
        open={isLoginRequiredDialogOpen}
        onOpenChange={setIsLoginRequiredDialogOpen}
      />
    </div>
  )
}
