'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, CircleX, ClipboardCheck, Eye, MoreHorizontal, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminAuth } from '@/components/admin-auth-provider'
import {
  WRITER_APPLICATION_STATUS,
  WRITER_APPLICATION_STATUS_LABEL,
  type WriterApplicationStatus,
} from '@/constants/writer-application.constant'
import { formatPhoneNumber } from '@/utils/phone-number'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

interface WriterApplication {
  id: string
  writer_user_id: string
  display_name: string
  username: string
  email: string
  phone_number: string | null
  social_links: Record<string, string>
  balance: string
  user_status: 'active' | 'banned'
  email_verified_at: string | null
  last_login_at: string | null
  user_created_at: string
  account_holder_first_name: string
  account_holder_last_name: string
  bank_code: string
  account_number: string
  application_status: WriterApplicationStatus
  created_at: string
  reviewed_at: string | null
  review_note: string | null
  reviewed_by: string | null
}

interface ApplicationsResponse {
  applications: WriterApplication[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

interface BankConfig {
  code: string
  name: string
  logo: string
}

const SOCIAL_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  website: 'เว็บไซต์',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function statusClass(status: WriterApplicationStatus) {
  if (status === WRITER_APPLICATION_STATUS.APPROVED)
    return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
  if (status === WRITER_APPLICATION_STATUS.REJECTED) return 'border-destructive/20 bg-destructive/10 text-destructive'
  return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400'
}

function BankLogo({ bank }: { bank: BankConfig | undefined }) {
  if (!bank) return null
  return <img src={`${apiUrl}/writer/${bank.logo}`} alt={bank.name} className="size-7 shrink-0 object-contain" />
}

export default function WriterApplicationsPage() {
  const { accessToken } = useAdminAuth()
  const [data, setData] = useState<ApplicationsResponse | null>(null)
  const [banks, setBanks] = useState<BankConfig[]>([])
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [status, setStatus] = useState<'all' | WriterApplicationStatus>('pending')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<{ application: WriterApplication; action: 'approve' | 'reject' } | null>(
    null,
  )
  const [detailsApplication, setDetailsApplication] = useState<WriterApplication | null>(null)
  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const loadApplications = useCallback(async () => {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)
    const query = new URLSearchParams({ page: String(page), limit: '20' })
    if (status !== 'all') query.set('status', status)
    if (submittedSearch) query.set('search', submittedSearch)
    try {
      const response = await fetch(`${apiUrl}/admin/writer-applications?${query}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      })
      const body = (await response.json().catch(() => null)) as ApplicationsResponse | { message?: string } | null
      if (!response.ok) throw new Error(body && 'message' in body ? body.message : 'ไม่สามารถโหลดใบสมัครนักเขียนได้')
      setData(body as ApplicationsResponse)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'ไม่สามารถโหลดใบสมัครนักเขียนได้')
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, page, status, submittedSearch])

  useEffect(() => {
    void loadApplications()
  }, [loadApplications])

  useEffect(() => {
    if (!accessToken) return
    void fetch(`${apiUrl}/writer/banks`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    })
      .then(async (response) => response.ok ? response.json() as Promise<{ banks: BankConfig[] }> : { banks: [] })
      .then((result) => setBanks(result.banks))
      .catch(() => setBanks([]))
  }, [accessToken])

  function findBank(code: string) {
    return banks.find((bank) => bank.code === code)
  }

  function openReview(application: WriterApplication, action: 'approve' | 'reject') {
    setReviewing({ application, action })
    setNote('')
  }

  function openDetails(application: WriterApplication) {
    setDetailsApplication(application)
  }

  async function submitReview() {
    if (!reviewing || !accessToken || isSaving) return
    if (reviewing.action === 'reject' && !note.trim()) {
      toast.error('กรุณาระบุเหตุผลที่ปฏิเสธ')
      return
    }
    setIsSaving(true)
    try {
      const response = await fetch(`${apiUrl}/admin/writer-applications/${reviewing.application.id}`, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ action: reviewing.action, ...(note.trim() ? { note: note.trim() } : {}) }),
      })
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) throw new Error(body?.message ?? 'ไม่สามารถพิจารณาใบสมัครนักเขียนได้')
      toast.success(
        reviewing.action === 'approve' ? 'อนุมัติการเป็นนักเขียนเรียบร้อยแล้ว' : 'ปฏิเสธใบสมัครเรียบร้อยแล้ว',
      )
      setReviewing(null)
      setNote('')
      await loadApplications()
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'ไม่สามารถพิจารณาใบสมัครนักเขียนได้')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="mx-auto w-full p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ClipboardCheck className="size-6 text-primary" />
          คำขอเป็นนักเขียน
        </h1>
      </div>
      <Card>
        <CardHeader className="gap-4 border-b">
          <div>
            <CardTitle>
              {data ? `พบ ${data.pagination.total.toLocaleString('th-TH')} ใบสมัคร` : 'กำลังโหลดใบสมัครนักเขียน'}
            </CardTitle>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <form
              className="flex flex-1 gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                setPage(1)
                setSubmittedSearch(search.trim())
              }}
            >
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหาชื่อ Username หรืออีเมล"
              />
              <Button type="submit" variant="outline" size="icon" aria-label="ค้นหา">
                <Search />
              </Button>
            </form>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as 'all' | WriterApplicationStatus)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue>
                  {() => (status === 'all' ? 'ทุกสถานะ' : WRITER_APPLICATION_STATUS_LABEL[status])}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                {Object.values(WRITER_APPLICATION_STATUS).map((value) => (
                  <SelectItem key={value} value={value}>
                    {WRITER_APPLICATION_STATUS_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-sm text-destructive">{error}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ผู้สมัคร</TableHead>
                  <TableHead>บัญชีรับเงิน</TableHead>
                  <TableHead>วันที่สมัคร</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>ผลการพิจารณา</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }, (_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Skeleton className="h-10 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-10 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-8 w-24" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : data?.applications.length ? (
                  data.applications.map((application) => (
                    <TableRow key={application.id}>
                      <TableCell>
                        <div className="font-medium">{application.display_name}</div>
                        <div className="text-xs text-muted-foreground">
                          @{application.username} · {application.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          <BankLogo bank={findBank(application.bank_code)} />
                          <span>
                            {findBank(application.bank_code)?.name ?? application.bank_code} •••• {application.account_number.slice(-4)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {application.account_holder_first_name} {application.account_holder_last_name}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(application.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusClass(application.application_status)}>
                          {WRITER_APPLICATION_STATUS_LABEL[application.application_status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-56 whitespace-normal">
                        <div className="text-sm">{application.review_note ?? '-'}</div>
                        {application.reviewed_by && (
                          <div className="mt-1 text-xs text-muted-foreground">โดย {application.reviewed_by}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon" aria-label={`จัดการคำขอของ ${application.display_name}`} />}
                          >
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetails(application)}>
                              <Eye />
                              ดูรายละเอียด
                            </DropdownMenuItem>
                          {application.application_status === WRITER_APPLICATION_STATUS.PENDING && (
                            <>
                              <DropdownMenuItem onClick={() => openReview(application, 'approve')}>
                                <CheckCircle2 />
                                อนุมัติ
                              </DropdownMenuItem>
                              <DropdownMenuItem variant="destructive" onClick={() => openReview(application, 'reject')}>
                                <CircleX />
                                ปฏิเสธ
                              </DropdownMenuItem>
                            </>
                          )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      ไม่พบใบสมัครที่ตรงกับเงื่อนไข
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="text-sm text-muted-foreground">
            หน้า {data?.pagination.page ?? 1} จาก {data?.pagination.totalPages ?? 1}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isLoading || page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              <ChevronLeft />
              ก่อนหน้า
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isLoading || !data || page >= data.pagination.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              ถัดไป
              <ChevronRight />
            </Button>
          </div>
        </div>
      </Card>
      <Dialog
        open={Boolean(detailsApplication)}
        onOpenChange={(open) => {
          if (!open) setDetailsApplication(null)
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>รายละเอียดผู้สมัครเป็นนักเขียน</DialogTitle>
            <DialogDescription>ตรวจสอบข้อมูลผู้ใช้และบัญชีรับเงินก่อนพิจารณาคำขอ</DialogDescription>
          </DialogHeader>
          {detailsApplication && (
            <div className="grid gap-6 text-sm">
              <section className="grid gap-3">
                <h2 className="font-semibold">ข้อมูลผู้ใช้</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">ชื่อที่แสดง</p>
                    <p>{detailsApplication.display_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Username</p>
                    <p>@{detailsApplication.username}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">อีเมล</p>
                    <p>{detailsApplication.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">เบอร์โทรศัพท์</p>
                    <p>{formatPhoneNumber(detailsApplication.phone_number) || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">สถานะบัญชี</p>
                    <p>{detailsApplication.user_status === 'active' ? 'ใช้งาน' : 'ถูกแบน'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">ยอดคงเหลือ</p>
                    <p>{Number(detailsApplication.balance).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">ยืนยันอีเมล</p>
                    <p>
                      {detailsApplication.email_verified_at
                        ? formatDate(detailsApplication.email_verified_at)
                        : 'ยังไม่ได้ยืนยัน'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">สมัครเมื่อ</p>
                    <p>{formatDate(detailsApplication.user_created_at)}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-muted-foreground">เข้าใช้งานล่าสุด</p>
                    <p>
                      {detailsApplication.last_login_at
                        ? formatDate(detailsApplication.last_login_at)
                        : 'ยังไม่เคยเข้าใช้งาน'}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-muted-foreground">Social</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
                      {Object.entries(detailsApplication.social_links ?? {})
                        .filter(([key, value]) => SOCIAL_LABELS[key] && value.trim())
                        .map(([key, value]) => (
                          <a
                            key={key}
                            href={value}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            {SOCIAL_LABELS[key]}: {value}
                          </a>
                        ))}
                      {Object.values(detailsApplication.social_links ?? {}).every((value) => !value.trim()) && <p>-</p>}
                    </div>
                  </div>
                </div>
              </section>
              <section className="grid gap-3 border-t pt-5">
                <h2 className="font-semibold">ข้อมูลบัญชีสำหรับรับเงิน</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">ชื่อเจ้าของบัญชี</p>
                    <p>
                      {detailsApplication.account_holder_first_name} {detailsApplication.account_holder_last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">ธนาคาร</p>
                    <div className="flex items-center gap-2">
                      <BankLogo bank={findBank(detailsApplication.bank_code)} />
                      <p>{findBank(detailsApplication.bank_code)?.name ?? detailsApplication.bank_code}</p>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-muted-foreground">เลขบัญชี</p>
                    <p>{detailsApplication.account_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">ยื่นคำขอเมื่อ</p>
                    <p>{formatDate(detailsApplication.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">สถานะคำขอ</p>
                    <Badge variant="outline" className={statusClass(detailsApplication.application_status)}>
                      {WRITER_APPLICATION_STATUS_LABEL[detailsApplication.application_status]}
                    </Badge>
                  </div>
                  {detailsApplication.reviewed_at && (
                    <div>
                      <p className="text-muted-foreground">พิจารณาเมื่อ</p>
                      <p>{formatDate(detailsApplication.reviewed_at)}</p>
                    </div>
                  )}
                  {detailsApplication.reviewed_by && (
                    <div>
                      <p className="text-muted-foreground">ผู้พิจารณา</p>
                      <p>{detailsApplication.reviewed_by}</p>
                    </div>
                  )}
                  {detailsApplication.review_note && (
                    <div className="sm:col-span-2">
                      <p className="text-muted-foreground">หมายเหตุผลพิจารณา</p>
                      <p className="whitespace-pre-line">{detailsApplication.review_note}</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsApplication(null)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(reviewing)}
        onOpenChange={(open) => {
          if (!open && !isSaving) {
            setReviewing(null)
            setNote('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewing?.action === 'approve' ? 'อนุมัติการเป็นนักเขียน' : 'ปฏิเสธใบสมัครนักเขียน'}
            </DialogTitle>
            <DialogDescription>
              {reviewing?.action === 'approve'
                ? `ผู้ใช้ ${reviewing?.application.display_name ?? ''} จะได้รับสิทธิ์เข้าสู่ Writer Studio`
                : `ระบุเหตุผลที่จะแจ้งให้ ${reviewing?.application.display_name ?? ''} ทราบ`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="writer-application-note">
              {reviewing?.action === 'approve' ? 'หมายเหตุ (ไม่บังคับ)' : 'เหตุผลที่ปฏิเสธ'}
            </Label>
            <Textarea
              id="writer-application-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={
                reviewing?.action === 'approve'
                  ? 'เช่น ตรวจสอบข้อมูลบัญชีเรียบร้อยแล้ว'
                  : 'เช่น ชื่อเจ้าของบัญชีไม่ตรงกับข้อมูลผู้สมัคร'
              }
              className="min-h-28 resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewing(null)
                setNote('')
              }}
              disabled={isSaving}
            >
              ยกเลิก
            </Button>
            <Button
              variant={reviewing?.action === 'reject' ? 'destructive' : 'default'}
              onClick={() => void submitReview()}
              disabled={isSaving || (reviewing?.action === 'reject' && !note.trim())}
            >
              {isSaving ? 'กำลังบันทึก...' : reviewing?.action === 'approve' ? 'ยืนยันการอนุมัติ' : 'ยืนยันการปฏิเสธ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
