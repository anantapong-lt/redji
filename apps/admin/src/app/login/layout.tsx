import { AdminAuthProvider } from '@/components/admin-auth-provider'

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>
}
