import { Footer } from '@/components/footer'
import { Navbar } from '@/components/navbar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_50%_-10%,rgb(208_198_176_/_0.76),transparent_39rem)] bg-no-repeat">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
