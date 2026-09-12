'use client'

import { useState } from 'react'
import { Heart, LoaderCircle } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { LoginRequiredDialog } from '@/components/auth/login-required-dialog'
import {
  favoritePublicContent,
  unfavoritePublicContent,
} from '@/controllers/content.controller'

export function FavoriteButton({
  slug,
  initialCount,
  initialIsFavorited,
}: {
  slug: string
  initialCount: number
  initialIsFavorited: boolean
}) {
  const { accessToken, status } = useAuth()
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited)
  const [favoriteCount, setFavoriteCount] = useState(initialCount)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isLoginRequiredDialogOpen, setIsLoginRequiredDialogOpen] = useState(false)

  async function toggleFavorite() {
    if (status !== 'authenticated' || !accessToken) {
      setIsLoginRequiredDialogOpen(true)
      return
    }
    if (isUpdating) return

    setIsUpdating(true)
    try {
      const favorite = isFavorited
        ? await unfavoritePublicContent(slug, accessToken)
        : await favoritePublicContent(slug, accessToken)
      setIsFavorited(favorite.is_favorited)
      setFavoriteCount(favorite.favorite_count)
    } catch {
      // Keep the last confirmed state when the request fails.
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <button
      type="button"
      disabled={isUpdating || status === 'loading'}
      onClick={() => void toggleFavorite()}
      aria-pressed={isFavorited}
      aria-label={isFavorited ? 'นำออกจากรายการโปรด' : 'เพิ่มเป็นรายการโปรด'}
      className={`flex h-9 w-fit cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-wait disabled:opacity-60 ${
        isFavorited
          ? 'border-primary/35 bg-primary/10 text-primary hover:bg-primary/15'
          : 'border-border bg-card text-muted-foreground hover:border-primary/45 hover:bg-accent hover:text-primary'
      }`}
    >
      {isUpdating ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Heart
          className={`size-4 ${isFavorited ? 'fill-current' : ''}`}
          aria-hidden="true"
        />
      )}
      รายการโปรด
      <span className="tabular-nums">{favoriteCount.toLocaleString('th-TH')}</span>
      <LoginRequiredDialog
        open={isLoginRequiredDialogOpen}
        onOpenChange={setIsLoginRequiredDialogOpen}
      />
    </button>
  )
}
