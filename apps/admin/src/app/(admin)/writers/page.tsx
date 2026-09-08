'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Search, UsersRound } from 'lucide-react'
import { useAdminAuth } from '@/components/admin-auth-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type UserStatus = 'active' | 'banned'

interface Writer {
  id: string
  display_name: string
  username: string
  email: string
  phone_number: string | null
  avatar_url: string | null
  status: UserStatus
  balance: string
  created_at: string
  last_login_at: string | null
  content_count: string
  chapter_count: string
  total_views: string
  sales_count: string
  sales_total: string
}

interface WritersResponse {
  writers: Writer[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const statusLabel: Record<UserStatus, string> = { active: 'ใช้งาน', banned: 'ถูกแบน' }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value))
}

function formatNumber(value: string) {
  return Number(value).toLocaleString('th-TH')
}

function formatCoin(value: string) {
  return Number(value).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function WritersPage() {
  const { accessToken } = useAdminAuth()
  const [data, setData] = useState<WritersResponse | null>(null)
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [status, setStatus] = useState<'all' | UserStatus>('all')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadWriters = useCallback(async () => {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)
    const query = new URLSearchParams({ page: String(page), limit: '20' })
    if (submittedSearch) query.set('search', submittedSearch)
    if (status !== 'all') query.set('status', status)
    try {
      const response = await fetch(`${apiUrl}/admin/writers?${query}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      })
      const body = await response.json().catch(() => null) as WritersResponse | { message?: string } | null
      if (!response.ok) throw new Error(body && 'message' in body ? body.message : 'ไม่สามารถโหลดรายชื่อนักเขียนได้')
      setData(body as WritersResponse)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'ไม่สามารถโหลดรายชื่อนักเขียนได้')
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, page, status, submittedSearch])

  useEffect(() => { void loadWriters() }, [loadWriters])

  return <main className="mx-auto w-full p-4 md:p-6">
    <div className="mb-6 flex flex-col gap-1"><h1 className="flex items-center gap-2 text-2xl font-semibold"><UsersRound className="size-6 text-primary" />นักเขียนทั้งหมด</h1></div>
    <Card>
      <CardHeader className="gap-4 border-b"><div><CardTitle>{data ? `พบ ${data.pagination.total.toLocaleString('th-TH')} นักเขียน` : 'กำลังโหลดรายชื่อนักเขียน'}</CardTitle></div><div className="flex flex-col gap-2 sm:flex-row"><form className="flex flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); setSubmittedSearch(search.trim()) }}><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ Username หรืออีเมล" /><Button type="submit" variant="outline" size="icon" aria-label="ค้นหา"><Search /></Button></form><Select value={status} onValueChange={(value) => { setStatus(value as 'all' | UserStatus); setPage(1) }}><SelectTrigger className="w-full sm:w-40"><SelectValue>{() => status === 'all' ? 'ทุกสถานะ' : statusLabel[status]}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">ทุกสถานะ</SelectItem><SelectItem value="active">ใช้งาน</SelectItem><SelectItem value="banned">ถูกแบน</SelectItem></SelectContent></Select></div></CardHeader>
      <CardContent className="p-0">{error ? <div className="p-6 text-sm text-destructive">{error}</div> : <Table><TableHeader><TableRow><TableHead>นักเขียน</TableHead><TableHead>สถานะ</TableHead><TableHead>ผลงาน</TableHead><TableHead>ยอดเข้าชม</TableHead><TableHead>ยอดขาย</TableHead><TableHead>ยอดคงเหลือ</TableHead><TableHead>เริ่มใช้งาน</TableHead></TableRow></TableHeader><TableBody>{isLoading ? Array.from({ length: 6 }, (_, index) => <TableRow key={index}>{Array.from({ length: 7 }, (_, cellIndex) => <TableCell key={cellIndex}><Skeleton className="h-5 w-24" /></TableCell>)}</TableRow>) : data?.writers.length ? data.writers.map((writer) => <TableRow key={writer.id}><TableCell><div className="flex items-center gap-3">{writer.avatar_url ? <img src={writer.avatar_url} alt="" className="size-9 rounded-full object-cover" /> : <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary"><UsersRound className="size-4" /></span>}<div><div className="font-medium">{writer.display_name}</div><div className="text-xs text-muted-foreground">@{writer.username} · {writer.email}</div></div></div></TableCell><TableCell><Badge variant={writer.status === 'active' ? 'secondary' : 'destructive'}>{statusLabel[writer.status]}</Badge></TableCell><TableCell><div className="flex items-center gap-1"><BookOpen className="size-4 text-muted-foreground" />{formatNumber(writer.content_count)} เรื่อง</div><div className="text-xs text-muted-foreground">{formatNumber(writer.chapter_count)} ตอน</div></TableCell><TableCell>{formatNumber(writer.total_views)}</TableCell><TableCell><div>{formatCoin(writer.sales_total)}</div><div className="text-xs text-muted-foreground">{formatNumber(writer.sales_count)} รายการ</div></TableCell><TableCell>{Number(writer.balance).toFixed(2)}</TableCell><TableCell>{formatDate(writer.created_at)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">ไม่พบนักเขียนที่ตรงกับเงื่อนไข</TableCell></TableRow>}</TableBody></Table>}</CardContent>
      <div className="flex items-center justify-between border-t px-4 py-3"><span className="text-sm text-muted-foreground">หน้า {data?.pagination.page ?? 1} จาก {data?.pagination.totalPages ?? 1}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={isLoading || page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft />ก่อนหน้า</Button><Button size="sm" variant="outline" disabled={isLoading || !data || page >= data.pagination.totalPages} onClick={() => setPage((current) => current + 1)}>ถัดไป<ChevronRight /></Button></div></div>
    </Card>
  </main>
}
