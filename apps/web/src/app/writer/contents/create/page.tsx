import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { StoryType } from '@/constants/story.constant'
import { CoverImageUpload } from './components/cover-image-upload'
import { CreateStoryForm } from './components/create-story-form'
import { SlugField } from './components/slug-field'
import { StoryGenreFields } from './components/story-genre-fields'
import { StoryMetadataFields } from './components/story-metadata-fields'
import { SynopsisField } from './components/synopsis-field'

type ContentType = 'novel' | 'cartoon'

interface CreateContentPageProps {
  searchParams: Promise<{
    type?: string | string[]
    title?: string | string[]
  }>
}

export default async function CreateContentPage({ searchParams }: CreateContentPageProps) {
  const params = await searchParams
  const contentType: ContentType = params.type === 'cartoon' ? 'cartoon' : 'novel'
  const isCartoon = contentType === 'cartoon'
  const contentLabel = isCartoon ? 'การ์ตูน' : 'นิยาย'
  const databaseType = isCartoon ? StoryType.MANGA : StoryType.NOVEL
  const initialTitle = typeof params.title === 'string' ? params.title : ''

  return (
    <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
          <div>
            <Link
              href={`/writer/contents/?tab=${contentType}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" strokeWidth={1.8} />
              กลับไปหน้าผลงาน
            </Link>
            <h1 className="mt-3 text-2xl font-bold tracking-[-0.025em] md:text-3xl">
              สร้าง{contentLabel}ใหม่
            </h1>
          </div>

          <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
            {contentLabel}
          </span>
        </div>

        <CreateStoryForm cancelHref={`/writer/contents/?tab=${contentType}`}>
          <input type="hidden" name="type" value={databaseType} />

          <section className="readji-surface grid gap-5 rounded-2xl p-5 md:grid-cols-2 md:p-6">
            <StoryMetadataFields contentLabel={contentLabel} initialTitle={initialTitle}>
              <SlugField />
              <SynopsisField contentLabel={contentLabel} />
            </StoryMetadataFields>

            <StoryGenreFields />
          </section>

          <aside className="readji-surface rounded-2xl p-5 md:p-6">
            <CoverImageUpload />
          </aside>

        </CreateStoryForm>
      </div>
    </main>
  )
}
