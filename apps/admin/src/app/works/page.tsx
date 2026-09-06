'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useAdminAuth } from '@/components/admin-auth-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type WorkType = 'novel' | 'manga'
type WorkStatus = 'draft' | 'ongoing' | 'completed' | 'hiatus' | 'cancelled'

interface Work {
  id: string
  title: string
  slug: string
  type: WorkType
  status: WorkStatus
  cover_url: string | null
  total_views: string
  chapter_count: string
  author: { username: string; display_name: string }
  primary_genre: { id: string; name: string }
  secondary_genre: { id: string; name: string } | null
}

interface WorksResponse {
  contents: Work[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

interface GenreOption { value: string; label: string }

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const typeLabels: Record<WorkType, string> = { novel: 'นิยาย', manga: 'การ์ตูน' }
const statusLabels: Record<WorkStatus, string> = {
  draft: 'ฉบับร่าง', ongoing: 'กำลังเผยแพร่', completed: 'จบแล้ว', hiatus: 'พักการเขียน', cancelled: 'ยกเลิก',
}

export default function WorksPage() {
  const { accessToken } = useAdminAuth()
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [type, setType] = useState<'all' | WorkType>('all')
  const [status, setStatus] = useState<'all' | WorkStatus>('all')
  const [genreId, setGenreId] = useState('all')
  const [genres, setGenres] = useState<GenreOption[]>([])
  const [data, setData] = useState<WorksResponse | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadWorks = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    const query = new URLSearchParams({ page: String(page), limit: '20' })
    if (submittedSearch) query.set('search', submittedSearch)
    if (type !== 'all') query.set('type', type)
    if (status !== 'all') query.set('status', status)
    if (genreId !== 'all') query.set('genre_id', genreId)

    try {
      const response = await fetch(`${apiUrl}/admin/contents?${query}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` }, credentials: 'include',
      })
      const body = (await response.json().catch(() => null)) as WorksResponse | { message?: string } | null
      if (!response.ok) throw new Error(body && 'message' in body ? body.message : 'ไม่สามารถโหลดรายการผลงานได้')
      setData(body as WorksResponse)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ไม่สามารถโหลดรายการผลงานได้')
    } finally {
      setLoading(false)
    }
  }, [accessToken, genreId, page, status, submittedSearch, type])

  useEffect(() => { void loadWorks() }, [loadWorks])

  useEffect(() => {
    if (!accessToken) return
    void fetch(`${apiUrl}/genres-options`, { headers: { Accept: 'application/json' }, credentials: 'include' })
      .then(async (response) => (response.ok ? (await response.json()) as { options: GenreOption[] } : null))
      .then((body) => { if (body) setGenres(body.options) })
      .catch(() => undefined)
  }, [accessToken])

  const applySearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPage(1); setSubmittedSearch(search.trim())
  }
  const changeFilter = (setter: (value: string) => void) => (value: string | null) => { setter(value ?? 'all'); setPage(1) }

  return (
    <main className="mx-auto w-full p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><BookOpen className="size-6 text-primary" />ผลงานทั้งหมด</h1>
      </div>
      <Card>
        <CardHeader className="gap-4 border-b">
          <CardTitle>{data ? `พบผลงาน ${data.pagination.total.toLocaleString('th-TH')} รายการ` : 'กำลังโหลดรายการผลงาน'}</CardTitle>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <form onSubmit={applySearch} className="flex gap-2 sm:col-span-2 lg:col-span-1">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อเรื่อง, Slug หรือผู้เขียน" aria-label="ค้นหาผลงาน" />
              <Button type="submit" variant="outline" size="icon" aria-label="ค้นหา"><Search /></Button>
            </form>
            <Select value={type} onValueChange={changeFilter(setType)}><SelectTrigger><SelectValue>{() => (type === 'all' ? 'ทุกประเภทผลงาน' : typeLabels[type])}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">ทุกประเภทผลงาน</SelectItem><SelectItem value="novel">นิยาย</SelectItem><SelectItem value="manga">การ์ตูน</SelectItem></SelectContent></Select>
            <Select value={status} onValueChange={changeFilter(setStatus)}><SelectTrigger><SelectValue>{() => (status === 'all' ? 'ทุกสถานะ' : statusLabels[status])}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">ทุกสถานะ</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            <Select value={genreId} onValueChange={changeFilter(setGenreId)}><SelectTrigger><SelectValue>{() => (genreId === 'all' ? 'ทุกหมวดหมู่' : genres.find((genre) => genre.value === genreId)?.label ?? 'ทุกหมวดหมู่')}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">ทุกหมวดหมู่</SelectItem>{genres.map((genre) => <SelectItem key={genre.value} value={genre.value}>{genre.label}</SelectItem>)}</SelectContent></Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error ? <div className="p-6 text-sm text-destructive">{error}</div> : <Table><TableHeader><TableRow><TableHead>ผลงาน</TableHead><TableHead>ผู้เขียน</TableHead><TableHead>ประเภท</TableHead><TableHead>หมวดหมู่</TableHead><TableHead>สถานะ</TableHead><TableHead>ตอน</TableHead><TableHead>เข้าชม</TableHead></TableRow></TableHeader><TableBody>
            {loading ? Array.from({ length: 6 }).map((_, index) => <TableRow key={index}>{Array.from({ length: 7 }).map((__, cell) => <TableCell key={cell}><Skeleton className="h-5 w-20" /></TableCell>)}</TableRow>) : data?.contents.length ? data.contents.map((work) => <TableRow key={work.id}><TableCell><div className="font-medium">{work.title}</div><div className="text-xs text-muted-foreground">/{work.slug}</div></TableCell><TableCell><div>{work.author.display_name}</div><div className="text-xs text-muted-foreground">@{work.author.username}</div></TableCell><TableCell><Badge variant="outline">{typeLabels[work.type]}</Badge></TableCell><TableCell><div>{work.primary_genre.name}</div>{work.secondary_genre && <div className="text-xs text-muted-foreground">{work.secondary_genre.name}</div>}</TableCell><TableCell><Badge variant={work.status === 'ongoing' || work.status === 'completed' ? 'secondary' : work.status === 'cancelled' ? 'destructive' : 'outline'}>{statusLabels[work.status]}</Badge></TableCell><TableCell>{Number(work.chapter_count).toLocaleString('th-TH')}</TableCell><TableCell>{Number(work.total_views).toLocaleString('th-TH')}</TableCell></TableRow>) : <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">ไม่พบผลงาน</TableCell></TableRow>}
          </TableBody></Table>}
          {data && data.pagination.totalPages > 1 && <div className="flex items-center justify-end gap-2 border-t p-4"><span className="text-sm text-muted-foreground">หน้า {data.pagination.page} / {data.pagination.totalPages}</span><Button variant="outline" size="icon" onClick={() => setPage((value) => value - 1)} disabled={page <= 1 || loading} aria-label="หน้าก่อนหน้า"><ChevronLeft /></Button><Button variant="outline" size="icon" onClick={() => setPage((value) => value + 1)} disabled={page >= data.pagination.totalPages || loading} aria-label="หน้าถัดไป"><ChevronRight /></Button></div>}
        </CardContent>
      </Card>
    </main>
  )
}
