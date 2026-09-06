import { AdminAuthProvider } from '@/components/admin-auth-provider'
import { AdminShell } from '@/components/admin-shell'
import { ServerAdminGuard } from '@/components/server-admin-guard'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ServerAdminGuard>
      <AdminAuthProvider initiallyAuthenticated>
        <AdminShell>{children}</AdminShell>
      </AdminAuthProvider>
    </ServerAdminGuard>
  )
}
