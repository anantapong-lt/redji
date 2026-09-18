import { Suspense } from 'react'
import { Footer } from '@/components/footer'
import { GenreOptionsInitializer } from '@/components/genre-options-initializer'
import { Navbar, NavbarSkeleton } from '@/components/navbar'
import { getServerFeatureConfig } from '@/lib/server-auth'

async function DeferredFooter({ featuresPromise }: {
  featuresPromise: ReturnType<typeof getServerFeatureConfig>
}) {
  const features = await featuresPromise

  return <Footer registrationEnabled={features?.registration === true} />
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const featuresPromise = getServerFeatureConfig()

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_50%_-10%,rgb(208_198_176_/_0.76),transparent_39rem)] bg-no-repeat">
      <GenreOptionsInitializer />
      <Suspense fallback={<NavbarSkeleton />}>
        <Navbar featuresPromise={featuresPromise} />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Suspense fallback={<Footer registrationEnabled={false} />}>
        <DeferredFooter featuresPromise={featuresPromise} />
      </Suspense>
    </div>
  )
}
