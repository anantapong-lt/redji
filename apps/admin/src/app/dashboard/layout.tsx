import { ServerAdminGuard } from '@/components/server-admin-guard'
import { AdminAuthProvider } from '@/components/admin-auth-provider'
import { AdminShell } from '@/components/admin-shell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ServerAdminGuard>
      <AdminAuthProvider initiallyAuthenticated>
        <AdminShell>{children}</AdminShell>
      </AdminAuthProvider>
    </ServerAdminGuard>
  )
}
