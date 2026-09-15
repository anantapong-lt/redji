'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, RotateCcw, Search } from 'lucide-react'
import { useAdminAuth } from '@/components/admin-auth-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatCoin } from '@/utils/format-coin'

type WorkType = 'novel' | 'manga'
type WorkStatus = 'active' | 'hidden' | 'suspended'
const WORK_STATUS = {
  ACTIVE: 'active',
  HIDDEN: 'hidden',
  SUSPENDED: 'suspended',
} as const

interface Work {
  id: string
  title: string
  slug: string
  type: WorkType
  status: WorkStatus
  deleted_at: string | null
  cover_url: string | null
  total_views: string
  chapter_count: string
  sales_total: string
  created_at: string
  author: { username: string; display_name: string }
  primary_genre: { id: string; name: string }
  secondary_genre: { id: string; name: string } | null
}

interface WorksResponse {
  contents: Work[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

interface GenreOption {
  value: string
  label: string
}

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const webUrl = (process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const typeLabels: Record<WorkType, string> = { novel: 'นิยาย', manga: 'การ์ตูน' }
const statusLabels: Record<WorkStatus, string> = {
  active: 'ใช้งาน',
  hidden: 'ซ่อน',
  suspended: 'ระงับ',
}
const statusBadgeClasses: Record<WorkStatus, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  hidden: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  suspended: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
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
  const [hidingId, setHidingId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [workToHide, setWorkToHide] = useState<Work | null>(null)
  const [workStatusToApply, setWorkStatusToApply] = useState<Exclude<WorkStatus, 'active'>>(WORK_STATUS.HIDDEN)
  const [hideReason, setHideReason] = useState('')
  const [hideReasonError, setHideReasonError] = useState<string | null>(null)

  const loadWorks = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    const query = new URLSearchParams({ page: String(page), limit: '20' })
    if (submittedSearch) query.set('search', submittedSearch)
    query.set('type', type)
    query.set('status', status)
    if (genreId !== 'all') query.set('genre_id', genreId)

    try {
      const response = await fetch(`${apiUrl}/admin/contents?${query}`, {
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
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

  useEffect(() => {
    void loadWorks()
  }, [loadWorks])

  useEffect(() => {
    if (!accessToken) return
    void fetch(`${apiUrl}/genres-options`, { headers: { Accept: 'application/json' }, credentials: 'include' })
      .then(async (response) => (response.ok ? ((await response.json()) as { options: GenreOption[] }) : null))
      .then((body) => {
        if (body) setGenres(body.options)
      })
      .catch(() => undefined)
  }, [accessToken])

  const applySearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setSubmittedSearch(search.trim())
  }
  const clearFilters = () => {
    setSearch('')
    setSubmittedSearch('')
    setType('all')
    setStatus('all')
    setGenreId('all')
    setPage(1)
  }
  const changeFilter = <Value extends string>(setter: React.Dispatch<React.SetStateAction<Value>>) => (value: string | null) => {
    setter((value ?? 'all') as Value)
    setPage(1)
  }

  const hideWork = async () => {
    if (!accessToken || !workToHide) return
    const reason = hideReason.trim()
    if (!reason) {
      setHideReasonError(`กรุณาระบุเหตุผลในการ${workStatusToApply === WORK_STATUS.SUSPENDED ? 'ระงับ' : 'ซ่อน'}ผลงาน`)
      return
    }
    const work = workToHide
    setHidingId(work.id)
    try {
      const response = await fetch(`${apiUrl}/admin/contents/${work.id}/status`, {
        method: 'PUT',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
        body: JSON.stringify({ status: workStatusToApply, reason }),
      })
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) throw new Error(body?.message ?? 'ไม่สามารถซ่อนผลงานได้')
      setWorkToHide(null)
      setHideReason('')
      setHideReasonError(null)
      await loadWorks()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ไม่สามารถซ่อนผลงานได้')
    } finally {
      setHidingId(null)
    }
  }

  const restoreWork = async (work: Work) => {
    if (!accessToken || restoringId !== null) return
    setRestoringId(work.id)
    try {
      const response = await fetch(`${apiUrl}/admin/contents/${work.id}/status`, {
        method: 'PUT',
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
        body: JSON.stringify({ status: WORK_STATUS.ACTIVE }),
      })
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) throw new Error(body?.message ?? 'ไม่สามารถเปิดการมองเห็นผลงานได้')
      await loadWorks()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ไม่สามารถเปิดการมองเห็นผลงานได้')
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <main className="mx-auto w-full p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <BookOpen className="size-6 text-primary" />
          ผลงานทั้งหมด
        </h1>
      </div>
      <Card>
        <CardHeader className="gap-4 border-b">
          <CardTitle>
            {data ? `พบผลงาน ${data.pagination.total.toLocaleString('th-TH')} รายการ` : 'กำลังโหลดรายการผลงาน'}
          </CardTitle>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <form id="works-filter" onSubmit={applySearch} className="min-w-0 flex-1 lg:max-w-xl">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหาชื่อเรื่อง, Slug หรือผู้เขียน"
                aria-label="ค้นหาผลงาน"
              />
            </form>
            <Select value={type} onValueChange={changeFilter(setType)}>
              <SelectTrigger className="w-full lg:w-44">
                <SelectValue>{() => (type === 'all' ? 'ทุกประเภทผลงาน' : typeLabels[type])}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภทผลงาน</SelectItem>
                <SelectItem value="novel">นิยาย</SelectItem>
                <SelectItem value="manga">การ์ตูน</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={changeFilter(setStatus)}>
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue>{() => (status === 'all' ? 'ทุกสถานะ' : statusLabels[status])}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={genreId} onValueChange={changeFilter(setGenreId)}>
              <SelectTrigger className="w-full lg:w-44">
                <SelectValue>
                  {() =>
                    genreId === 'all'
                      ? 'ทุกหมวดหมู่'
                      : (genres.find((genre) => genre.value === genreId)?.label ?? 'ทุกหมวดหมู่')
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                {genres.map((genre) => (
                  <SelectItem key={genre.value} value={genre.value}>
                    {genre.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={clearFilters}>
              <RotateCcw />
              ล้างตัวกรอง
            </Button>
            <Button type="submit" form="works-filter" variant="default" size="icon" aria-label="ค้นหา">
              <Search />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-sm text-destructive">{error}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ผลงาน</TableHead>
                  <TableHead>ผู้สร้าง</TableHead>
                  <TableHead className="text-right">ยอดขาย</TableHead>
                  <TableHead className="text-right">จำนวนตอน</TableHead>
                  <TableHead className="text-right">ยอดวิว</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>วันที่สร้าง</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 10 }).map((__, cell) => (
                        <TableCell key={cell}>
                          <Skeleton className="h-5 w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : data?.contents.length ? (
                  data.contents.map((work) => (
                    <TableRow key={work.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                            {work.cover_url ? (
                              <img
                                src={work.cover_url}
                                alt={`ปกเรื่อง ${work.title}`}
                                className="size-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <BookOpen className="m-auto mt-4 size-6 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium">{work.title}</div>
                            <a
                              href={`${webUrl}/content/${encodeURIComponent(work.slug)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary underline-offset-4 hover:underline"
                            >
                              /{work.slug}
                            </a>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{work.author.display_name}</div>
                        <div className="text-xs text-muted-foreground">@{work.author.username}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCoin(work.sales_total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(work.chapter_count).toLocaleString('th-TH')}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(work.total_views).toLocaleString('th-TH')}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            work.type === 'novel'
                              ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300'
                              : 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300'
                          }
                        >
                          {typeLabels[work.type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>{work.primary_genre.name}</div>
                        {work.secondary_genre && (
                          <div className="text-xs text-muted-foreground">{work.secondary_genre.name}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            work.status === WORK_STATUS.SUSPENDED
                              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300'
                              : statusBadgeClasses[work.status]
                          }
                        >
                          {statusLabels[work.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(work.created_at))}</TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={work.status}
                          onValueChange={(value) => {
                            if (value === work.status) return
                            if (value === WORK_STATUS.ACTIVE) {
                              void restoreWork(work)
                              return
                            }
                            setWorkToHide(work)
                            setWorkStatusToApply(value as Exclude<WorkStatus, 'active'>)
                            setHideReason('')
                            setHideReasonError(null)
                          }}
                        >
                          <SelectTrigger className="ml-auto h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={WORK_STATUS.ACTIVE}>ใช้งาน</SelectItem>
                            <SelectItem value={WORK_STATUS.SUSPENDED}>ระงับ</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                      ไม่พบผลงาน
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 border-t p-4">
              <span className="text-sm text-muted-foreground">
                หน้า {data.pagination.page} / {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((value) => value - 1)}
                disabled={page <= 1 || loading}
                aria-label="หน้าก่อนหน้า"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((value) => value + 1)}
                disabled={page >= data.pagination.totalPages || loading}
                aria-label="หน้าถัดไป"
              >
                <ChevronRight />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={workToHide !== null}
        onOpenChange={(open) => {
          if (!open && !hidingId) {
            setWorkToHide(null)
            setHideReason('')
            setHideReasonError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการ{workStatusToApply === WORK_STATUS.SUSPENDED ? 'ระงับ' : 'ซ่อน'}ผลงาน</DialogTitle>
            <DialogDescription>
              {workStatusToApply === WORK_STATUS.SUSPENDED
                ? `ต้องการระงับผลงาน “${workToHide?.title ?? ''}” ใช่หรือไม่? ผลงานจะไม่แสดงบนเว็บไซต์จนกว่าแอดมินจะเปิดใช้งานอีกครั้ง`
                : `ต้องการซ่อนผลงาน “${workToHide?.title ?? ''}” ใช่หรือไม่? ผลงานจะไม่แสดงบนเว็บไซต์ แต่เจ้าของยังจัดการผลงานได้`}
            </DialogDescription>
            <div className="space-y-2">
              <label htmlFor="hide-work-reason" className="text-sm font-medium">
                เหตุผลในการ{workStatusToApply === WORK_STATUS.SUSPENDED ? 'ระงับ' : 'ซ่อน'} <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="hide-work-reason"
                value={hideReason}
                onChange={(event) => {
                  setHideReason(event.target.value)
                  if (hideReasonError) setHideReasonError(null)
                }}
                placeholder={`ระบุเหตุผลในการ${workStatusToApply === WORK_STATUS.SUSPENDED ? 'ระงับ' : 'ซ่อน'}ผลงาน`}
                maxLength={1000}
                disabled={hidingId !== null}
                aria-invalid={Boolean(hideReasonError)}
              />
              {hideReasonError ? <p className="text-sm text-destructive">{hideReasonError}</p> : null}
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setWorkToHide(null)
              setHideReason('')
              setHideReasonError(null)
            }} disabled={hidingId !== null}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={() => void hideWork()} disabled={hidingId !== null}>
              {hidingId ? 'กำลังบันทึก...' : `${workStatusToApply === WORK_STATUS.SUSPENDED ? 'ระงับ' : 'ซ่อน'}ผลงาน`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
