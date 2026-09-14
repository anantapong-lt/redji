import { Footer } from '@/components/footer'
import { GenreOptionsInitializer } from '@/components/genre-options-initializer'
import { Navbar } from '@/components/navbar'
import { getServerFeatureConfig } from '@/lib/server-auth'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const features = await getServerFeatureConfig()

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_50%_-10%,rgb(208_198_176_/_0.76),transparent_39rem)] bg-no-repeat">
      <GenreOptionsInitializer />
      <Navbar features={features} />
      <main className="flex-1">{children}</main>
      <Footer registrationEnabled={features?.registration === true} />
    </div>
  )
}
