'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, Users } from 'lucide-react'
import { useAdminAuth } from '@/components/admin-auth-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type UserStatus = 'active' | 'suspended' | 'banned'

interface AdminUser {
  id: string
  email: string
  username: string
  display_name: string
  balance: string
  role: 'user' | 'writer' | 'super_admin'
  status: UserStatus
  email_verified_at: string | null
  last_login_at: string | null
  created_at: string
}

interface UsersResponse {
  users: AdminUser[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const statusLabels: Record<UserStatus, string> = { active: 'ใช้งาน', suspended: 'ระงับชั่วคราว', banned: 'ถูกแบน' }
const roleLabels: Record<AdminUser['role'], string> = { user: 'ผู้ใช้', writer: 'นักเขียน', super_admin: 'Super Admin' }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value))
}

export default function UsersPage() {
  const { accessToken } = useAdminAuth()
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [status, setStatus] = useState<'all' | UserStatus>('all')
  const [data, setData] = useState<UsersResponse | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    if (!accessToken) return

    setLoading(true)
    setError(null)
    const query = new URLSearchParams({ page: String(page), limit: '20' })
    if (submittedSearch) query.set('search', submittedSearch)
    if (status !== 'all') query.set('status', status)

    try {
      const response = await fetch(`${apiUrl}/admin/users?${query}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      })
      const body = await response.json().catch(() => null) as UsersResponse | { message?: string } | null
      if (!response.ok) throw new Error(body && 'message' in body ? body.message : 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้')
      setData(body as UsersResponse)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้')
    } finally {
      setLoading(false)
    }
  }, [accessToken, page, status, submittedSearch])

  useEffect(() => { void loadUsers() }, [loadUsers])

  const applySearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setSubmittedSearch(search.trim())
  }

  const changeStatus = (value: string | null) => {
    setStatus(value === 'active' || value === 'suspended' || value === 'banned' ? value : 'all')
    setPage(1)
  }

  return (
    <main className="mx-auto w-full p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Users className="size-6 text-primary" />ผู้ใช้ทั้งหมด</h1>
        <p className="text-sm text-muted-foreground">จัดการและตรวจสอบบัญชีผู้ใช้ในระบบ</p>
      </div>

      <Card>
        <CardHeader className="gap-4 border-b">
          <div>
            <CardTitle>รายชื่อผู้ใช้</CardTitle>
            <CardDescription>{data ? `พบผู้ใช้ ${data.pagination.total.toLocaleString('th-TH')} ราย` : 'กำลังโหลดข้อมูลผู้ใช้'}</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form onSubmit={applySearch} className="flex flex-1 gap-2 sm:min-w-80">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ, Username หรืออีเมล" aria-label="ค้นหาผู้ใช้" />
              <Button type="submit" variant="outline" size="icon" aria-label="ค้นหา"><Search /></Button>
            </form>
            <Select value={status} onValueChange={changeStatus}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue>{(value) => value === 'active' || value === 'suspended' || value === 'banned' ? statusLabels[value as UserStatus] : 'ทุกสถานะ'}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="active">ใช้งาน</SelectItem>
                <SelectItem value="suspended">ระงับชั่วคราว</SelectItem>
                <SelectItem value="banned">ถูกแบน</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error ? <div className="p-6 text-sm text-destructive">{error}</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>ผู้ใช้</TableHead><TableHead>บทบาท</TableHead><TableHead>สถานะ</TableHead><TableHead>ยอดคงเหลือ</TableHead><TableHead>สมัครเมื่อ</TableHead><TableHead>เข้าใช้ล่าสุด</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 6 }).map((_, index) => <TableRow key={index}><TableCell><Skeleton className="h-9 w-52" /></TableCell><TableCell><Skeleton className="h-5 w-16" /></TableCell><TableCell><Skeleton className="h-5 w-20" /></TableCell><TableCell><Skeleton className="h-5 w-16" /></TableCell><TableCell><Skeleton className="h-5 w-20" /></TableCell><TableCell><Skeleton className="h-5 w-20" /></TableCell></TableRow>) : data?.users.length ? data.users.map((user) => <TableRow key={user.id}><TableCell><div className="font-medium">{user.display_name}</div><div className="text-xs text-muted-foreground">@{user.username} · {user.email}</div></TableCell><TableCell><Badge variant="outline">{roleLabels[user.role]}</Badge></TableCell><TableCell><Badge variant={user.status === 'active' ? 'secondary' : user.status === 'banned' ? 'destructive' : 'outline'}>{statusLabels[user.status]}</Badge></TableCell><TableCell>{Number(user.balance).toFixed(2)}</TableCell><TableCell>{formatDate(user.created_at)}</TableCell><TableCell>{user.last_login_at ? formatDate(user.last_login_at) : 'ยังไม่เคยเข้าใช้'}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="text-sm text-muted-foreground">หน้า {data?.pagination.page ?? 1} จาก {data?.pagination.totalPages ?? 1}</span>
          <div className="flex gap-2"><Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft />ก่อนหน้า</Button><Button variant="outline" size="sm" disabled={loading || !data || page >= data.pagination.totalPages} onClick={() => setPage((current) => current + 1)}>ถัดไป<ChevronRight /></Button></div>
        </div>
      </Card>
    </main>
  )
}
