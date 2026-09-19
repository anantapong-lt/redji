import { Suspense } from 'react'
import { Footer } from '@/components/footer'
import { getServerFeatureConfig } from '@/lib/server-auth'

async function DeferredFooter({ featuresPromise }: {
  featuresPromise: ReturnType<typeof getServerFeatureConfig>
}) {
  const features = await featuresPromise

  return <Footer registrationEnabled={features?.registration === true} />
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const featuresPromise = getServerFeatureConfig()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        {children}
      </main>
      <Suspense fallback={<Footer registrationEnabled={false} />}>
        <DeferredFooter featuresPromise={featuresPromise} />
      </Suspense>
    </div>
  )
}
