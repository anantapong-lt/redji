'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { StoryType } from '@/constants/story.constant'
import { getWriterContent } from '@/controllers/writer.controller'
import type {
  WriterContentDetail,
  WriterContentTab,
} from '@/interface/writer-content.interface'
import { CoverImageUpload } from './cover-image-upload'
import { CreateStoryForm } from './create-story-form'
import { SlugField } from './slug-field'
import { StoryGenreFields } from './story-genre-fields'
import { StoryMetadataFields } from './story-metadata-fields'
import { SynopsisField } from './synopsis-field'

interface ContentEditorProps {
  contentId?: string
  initialContentType?: WriterContentTab
  initialTitle?: string
}

export function ContentEditor({
  contentId,
  initialContentType = 'novel',
  initialTitle = '',
}: ContentEditorProps) {
  const { accessToken, status } = useAuth()
  const [story, setStory] = useState<WriterContentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(contentId))
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!contentId) return
    if (!accessToken) {
      if (status === 'unauthenticated') {
        setIsLoading(false)
        setLoadError('ไม่พบข้อมูลการเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง')
      }
      return
    }

    let cancelled = false
    setIsLoading(true)
    setLoadError(null)

    void getWriterContent(contentId, accessToken)
      .then(({ story: nextStory }) => {
        if (!cancelled) setStory(nextStory)
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'ไม่สามารถโหลดเนื้อหาได้')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, contentId, status])

  if (isLoading) {
    return (
      <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
        <div className="readji-surface mx-auto max-w-7xl rounded-2xl p-8 text-center text-sm text-muted-foreground">
          กำลังโหลดข้อมูลเนื้อหา...
        </div>
      </main>
    )
  }

  if (contentId && (loadError || !story)) {
    return (
      <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
        <div className="readji-surface mx-auto max-w-7xl rounded-2xl p-8 text-center">
          <p className="text-sm text-destructive">
            {loadError ?? 'ไม่พบเนื้อหาที่ต้องการแก้ไข'}
          </p>
          <Link
            href="/writer/contents"
            className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
          >
            กลับไปหน้าผลงาน
          </Link>
        </div>
      </main>
    )
  }

  const contentType: WriterContentTab = story?.type === StoryType.MANGA
    ? 'cartoon'
    : initialContentType
  const isCartoon = contentType === 'cartoon'
  const contentLabel = isCartoon ? 'การ์ตูน' : 'นิยาย'
  const databaseType = isCartoon ? StoryType.MANGA : StoryType.NOVEL
  const cancelHref = `/writer/contents/?tab=${contentType}`

  return (
    <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
          <div>
            <Link
              href={cancelHref}
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" strokeWidth={1.8} />
              กลับไปหน้าผลงาน
            </Link>
            <h1 className="mt-3 text-2xl font-bold tracking-[-0.025em] md:text-3xl">
              {contentId ? `แก้ไข${contentLabel}` : `สร้าง${contentLabel}ใหม่`}
            </h1>
          </div>

          <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
            {contentLabel}
          </span>
        </div>

        <CreateStoryForm cancelHref={cancelHref} contentId={contentId}>
          <input type="hidden" name="type" value={databaseType} />

          <section className="readji-surface grid gap-5 rounded-2xl p-5 md:grid-cols-2 md:p-6">
            <StoryMetadataFields
              contentLabel={contentLabel}
              initialTitle={story?.title ?? initialTitle}
              initialStatus={story?.status}
              initialAgeRating={story?.age_rating?.toString() ?? ''}
            >
              <SlugField initialSlug={story?.slug} />
              <SynopsisField
                contentLabel={contentLabel}
                initialSynopsis={story?.synopsis ?? ''}
              />
            </StoryMetadataFields>

            <StoryGenreFields
              initialPrimaryGenreId={story?.primary_genre_id}
              initialSecondaryGenreId={story?.secondary_genre_id ?? ''}
            />
          </section>

          <aside className="readji-surface rounded-2xl p-5 md:p-6">
            <CoverImageUpload
              initialCoverUrl={story?.cover_url}
              showRemoveButton={!contentId}
            />
          </aside>
        </CreateStoryForm>
      </div>
    </main>
  )
}
