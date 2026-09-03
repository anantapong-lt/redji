/**
 * app/(auth)/layout.tsx
 *
 * Layout สำหรับหน้า login / register / forgot-password
 * ไม่มี Navbar — จงใจให้หน้าสะอาด ไม่มี distraction
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_-15%,rgb(208_198_176_/_0.88),transparent_38rem)] px-4 py-12">
      {children}
    </div>
  )
}
