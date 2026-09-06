'use client'

import { useMemo, useState } from 'react'
import { Banknote, CheckCircle2, ExternalLink, Eye, FileText, MoreHorizontal, Search, UploadCloud, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

type WithdrawalStatus = 'pending' | 'approved' | 'paid' | 'rejected'
type PaymentMethod = 'bank' | 'promptpay'
type DateRange = 'all' | 'today' | '7d' | '30d'

interface WithdrawalRequest {
  id: string
  user: { displayName: string; username: string }
  requestedAmount: number
  fee: number
  netAmount: number
  paymentMethod: PaymentMethod
  account: string
  submittedAt: string
  status: WithdrawalStatus
  processedBy: string | null
  note: string | null
  transferProofName: string | null
  transferProofUrl: string | null
}

const mockProofUrl = (requestId: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"><rect width="720" height="960" fill="#fffdfa"/><rect x="48" y="48" width="624" height="864" rx="24" fill="#f7ece8" stroke="#e5dfd9" stroke-width="2"/><text x="360" y="160" text-anchor="middle" fill="#2d1d20" font-family="Arial, sans-serif" font-size="30" font-weight="700">Readji Transfer Proof</text><text x="360" y="230" text-anchor="middle" fill="#74676a" font-family="Arial, sans-serif" font-size="22">${requestId}</text><path d="M260 390h200v120H260z" fill="#ff6f63" opacity=".18"/><path d="M290 450l45 45 95-110" fill="none" stroke="#ff6f63" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/><text x="360" y="650" text-anchor="middle" fill="#2d1d20" font-family="Arial, sans-serif" font-size="26">ตัวอย่างหลักฐานการโอน</text></svg>`)}`

const mockRequests: WithdrawalRequest[] = [
  {
    id: 'WD-000128',
    user: { displayName: 'Narin P.', username: 'narin_writer' },
    requestedAmount: 2500,
    fee: 250,
    netAmount: 2250,
    paymentMethod: 'bank',
    account: 'Kasikorn Bank •••• 4821',
    submittedAt: '2026-09-06T09:42:00+07:00',
    status: 'pending',
    processedBy: null,
    note: null,
    transferProofName: null,
    transferProofUrl: null,
  },
  {
    id: 'WD-000127',
    user: { displayName: 'Mali S.', username: 'maliscript' },
    requestedAmount: 1800,
    fee: 180,
    netAmount: 1620,
    paymentMethod: 'promptpay',
    account: 'PromptPay •••• 7190',
    submittedAt: '2026-09-06T08:15:00+07:00',
    status: 'approved',
    processedBy: 'admin@readji.com',
    note: 'อนุมัติแล้วและอยู่ระหว่างรอจ่ายเงิน',
    transferProofName: 'slip-WD-000127.pdf',
    transferProofUrl: mockProofUrl('WD-000127'),
  },
  {
    id: 'WD-000126',
    user: { displayName: 'Krit T.', username: 'krit_works' },
    requestedAmount: 4200,
    fee: 420,
    netAmount: 3780,
    paymentMethod: 'bank',
    account: 'SCB •••• 1038',
    submittedAt: '2026-09-05T16:30:00+07:00',
    status: 'paid',
    processedBy: 'finance@readji.com',
    note: 'โอนเงินเรียบร้อยแล้ว',
    transferProofName: 'slip-WD-000126.png',
    transferProofUrl: mockProofUrl('WD-000126'),
  },
  {
    id: 'WD-000125',
    user: { displayName: 'Ploy N.', username: 'ploy_novel' },
    requestedAmount: 950,
    fee: 95,
    netAmount: 855,
    paymentMethod: 'promptpay',
    account: 'PromptPay •••• 2246',
    submittedAt: '2026-09-04T14:05:00+07:00',
    status: 'rejected',
    processedBy: 'admin@readji.com',
    note: 'ชื่อเจ้าของบัญชีไม่ตรงกับชื่อผู้ใช้งานที่ลงทะเบียนไว้',
    transferProofName: null,
    transferProofUrl: null,
  },
  {
    id: 'WD-000124',
    user: { displayName: 'Thanawat K.', username: 'thanawat_k' },
    requestedAmount: 3200,
    fee: 320,
    netAmount: 2880,
    paymentMethod: 'bank',
    account: 'KTB •••• 6672',
    submittedAt: '2026-09-02T11:20:00+07:00',
    status: 'paid',
    processedBy: 'finance@readji.com',
    note: 'โอนเงินเรียบร้อยแล้ว',
    transferProofName: 'slip-WD-000124.jpg',
    transferProofUrl: mockProofUrl('WD-000124'),
  },
]

const statusLabels: Record<WithdrawalStatus, string> = {
  pending: 'รอตรวจสอบ',
  approved: 'อนุมัติแล้ว',
  paid: 'จ่ายเงินแล้ว',
  rejected: 'ปฏิเสธ',
}

const statusClasses: Record<WithdrawalStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  approved: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  rejected: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
}

const methodLabels: Record<PaymentMethod, string> = { bank: 'โอนผ่านธนาคาร', promptpay: 'พร้อมเพย์' }
const statusNotes: Record<Exclude<WithdrawalStatus, 'pending'>, string> = {
  approved: 'อนุมัติแล้วและอยู่ระหว่างรอจ่ายเงิน',
  paid: 'โอนเงินเรียบร้อยแล้ว',
  rejected: 'ปฏิเสธคำขอโดยผู้ดูแลระบบ',
}

const money = (amount: number) => amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateTime = (value: string) => new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

export default function TransactionsPage() {
  const [requests, setRequests] = useState(mockRequests)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | WithdrawalStatus>('all')
  const [method, setMethod] = useState<'all' | PaymentMethod>('all')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null)
  const [approvalRequest, setApprovalRequest] = useState<WithdrawalRequest | null>(null)
  const [transferProofName, setTransferProofName] = useState('')
  const [transferProofUrl, setTransferProofUrl] = useState('')
  const [isDraggingProof, setIsDraggingProof] = useState(false)
  const [transferProofError, setTransferProofError] = useState<string | null>(null)
  const [approvalNote, setApprovalNote] = useState('')
  const [rejectionRequest, setRejectionRequest] = useState<WithdrawalRequest | null>(null)
  const [rejectionNote, setRejectionNote] = useState('')

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase()
    const now = Date.now()
    const rangeInMilliseconds: Record<Exclude<DateRange, 'all'>, number> = {
      today: 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }

    return requests.filter((request) => {
      const matchesSearch =
        !query ||
        [request.id, request.user.displayName, request.user.username].some((value) =>
          value.toLowerCase().includes(query),
        )
      const matchesStatus = status === 'all' || request.status === status
      const matchesMethod = method === 'all' || request.paymentMethod === method
      const matchesDate =
        dateRange === 'all' || now - new Date(request.submittedAt).getTime() <= rangeInMilliseconds[dateRange]
      return matchesSearch && matchesStatus && matchesMethod && matchesDate
    })
  }, [dateRange, method, requests, search, status])

  function updateStatus(
    requestId: string,
    nextStatus: Exclude<WithdrawalStatus, 'pending'>,
    options: { proofName?: string; proofUrl?: string; note?: string } = {},
  ) {
    const updateRequest = (request: WithdrawalRequest): WithdrawalRequest =>
      request.id === requestId
        ? {
            ...request,
            status: nextStatus,
            processedBy: 'admin@readji.com',
            note: options.note?.trim() || statusNotes[nextStatus],
            transferProofName:
              nextStatus === 'approved' ? (options.proofName ?? request.transferProofName) : request.transferProofName,
            transferProofUrl:
              nextStatus === 'approved' ? (options.proofUrl ?? request.transferProofUrl) : request.transferProofUrl,
          }
        : request

    setRequests((current) => current.map(updateRequest))
    setSelectedRequest((current) => (current?.id === requestId ? updateRequest(current) : current))
  }

  function approveRequest() {
    if (!approvalRequest || !transferProofName) return
    updateStatus(approvalRequest.id, 'approved', { proofName: transferProofName, proofUrl: transferProofUrl, note: approvalNote })
    closeApprovalDialog()
  }

  function rejectRequest() {
    if (!rejectionRequest || !rejectionNote.trim()) return
    updateStatus(rejectionRequest.id, 'rejected', { note: rejectionNote })
    setRejectionRequest(null)
    setRejectionNote('')
  }

  function selectTransferProof(file: File | undefined) {
    if (!file) return

    if (!['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) {
      setTransferProofError('รองรับเฉพาะไฟล์ PNG, JPG และ PDF')
      return
    }

    setTransferProofName(file.name)
    setTransferProofUrl(URL.createObjectURL(file))
    setTransferProofError(null)
  }

  function closeApprovalDialog() {
    setApprovalRequest(null)
    setTransferProofName('')
    setTransferProofUrl('')
    setTransferProofError(null)
    setIsDraggingProof(false)
    setApprovalNote('')
  }

  return (
    <main className="mx-auto w-full p-4 md:p-6">
      <div className="space-y-5">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Banknote className="size-6 text-primary" />
            คำขอถอนเงิน
          </h1>
        </div>

        <Card>
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full space-y-2 sm:w-40">
                <Label>สถานะ</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as 'all' | WithdrawalStatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{() => (status === 'all' ? 'ทั้งหมด' : statusLabels[status])}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full space-y-2 sm:w-44">
                <Label>ประเภท</Label>
                <Select value={method} onValueChange={(value) => setMethod(value as 'all' | PaymentMethod)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{() => (method === 'all' ? 'ทั้งหมด' : methodLabels[method])}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    {Object.entries(methodLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full space-y-2 sm:w-44">
                <Label>ช่วงเวลา</Label>
                <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {() =>
                        ({ all: 'ทั้งหมด', today: 'วันนี้', '7d': '7 วันที่ผ่านมา', '30d': '30 วันที่ผ่านมา' })[
                          dateRange
                        ]
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="today">วันนี้</SelectItem>
                    <SelectItem value="7d">7 วันที่ผ่านมา</SelectItem>
                    <SelectItem value="30d">30 วันที่ผ่านมา</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="relative w-full sm:ml-auto sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ค้นหารหัสคำขอหรือผู้ใช้งาน"
                  aria-label="ค้นหาคำขอถอนเงิน"
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border bg-card shadow-none">
          <CardContent className="p-0">
            <Table className="min-w-[1180px]">
              <TableHeader>
                <TableRow>
                  <TableHead>เมื่อ</TableHead>
                  <TableHead>ผู้ขอถอน</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>บัญชีรับเงิน</TableHead>
                  <TableHead className="text-right">ยอดที่ขอถอน</TableHead>
                  <TableHead className="text-right">ยอดสุทธิ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>ผู้ดำเนินการ</TableHead>
                  <TableHead>หมายเหตุ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length ? (
                  filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="py-3">
                        <div className="font-medium">{dateTime(request.submittedAt)}</div>
                        <div className="text-xs text-muted-foreground">{request.id}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="font-medium">{request.user.displayName}</div>
                        <div className="text-xs text-muted-foreground">
                          {request.user.displayName} · @{request.user.username}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">{methodLabels[request.paymentMethod]}</TableCell>
                      <TableCell className="py-3">
                        <div className="font-medium">{request.account}</div>
                        <div className="text-xs text-muted-foreground">
                          {request.paymentMethod === 'bank' ? 'บัญชีธนาคาร' : 'หมายเลขพร้อมเพย์'}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-right font-medium">{money(request.requestedAmount)}</TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="font-medium text-primary">{money(request.netAmount)}</div>
                        <div className="text-xs text-muted-foreground">ค่าธรรมเนียม {money(request.fee)}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className={statusClasses[request.status]}>
                          {statusLabels[request.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-muted-foreground">{request.processedBy ?? '-'}</TableCell>
                      <TableCell className="max-w-48 py-3 whitespace-normal text-muted-foreground">
                        {request.note ?? '-'}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`จัดการ ${request.id}`}
                                title="จัดการสถานะ"
                              />
                            }
                          >
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedRequest(request)}>
                              <Eye />
                              ดูรายละเอียด
                            </DropdownMenuItem>
                            {request.status === 'pending' && (
                              <>
                                <DropdownMenuItem onClick={() => setApprovalRequest(request)}>
                                  <CheckCircle2 />
                                  อนุมัติ
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setRejectionRequest(request)}
                                >
                                  <XCircle />
                                  ปฏิเสธ
                                </DropdownMenuItem>
                              </>
                            )}
                            {request.status === 'approved' && (
                              <DropdownMenuItem onClick={() => updateStatus(request.id, 'paid')}>
                                <CheckCircle2 />
                                ยืนยันการจ่ายเงิน
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      ไม่พบคำขอถอนเงิน
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog
          open={selectedRequest !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedRequest(null)
          }}
        >
          <DialogContent className="max-h-[calc(100svh-2rem)] max-w-xl gap-0 overflow-y-auto p-0 sm:max-w-xl">
            {selectedRequest && (
              <>
                <DialogHeader className="gap-3 border-b bg-accent/50 px-6 py-5 pr-12">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <DialogTitle className="text-lg">รายละเอียดคำขอถอนเงิน</DialogTitle>
                      <DialogDescription className="mt-1 font-mono text-xs">{selectedRequest.id}</DialogDescription>
                    </div>
                    <Badge variant="outline" className={statusClasses[selectedRequest.status]}>
                      {statusLabels[selectedRequest.status]}
                    </Badge>
                  </div>
                </DialogHeader>

                <div className="space-y-5 p-6">
                  <section className="rounded-xl border border-primary/20 bg-primary/10 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">ยอดที่จะได้รับ</p>
                        <p className="mt-1 text-3xl font-semibold tracking-tight text-primary">{money(selectedRequest.netAmount)}</p>
                      </div>
                      <div className="rounded-lg bg-primary/15 p-2.5 text-primary"><Banknote className="size-5" /></div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-primary/15 pt-3 text-sm">
                      <div><p className="text-muted-foreground">ยอดที่ขอถอน</p><p className="mt-1 font-medium">{money(selectedRequest.requestedAmount)}</p></div>
                      <div><p className="text-muted-foreground">ค่าธรรมเนียม</p><p className="mt-1 font-medium">{money(selectedRequest.fee)}</p></div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className="text-sm font-semibold">ข้อมูลคำขอ</p>
                    <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
                      <Detail label="ผู้ขอถอน" value={`${selectedRequest.user.displayName} (@${selectedRequest.user.username})`} />
                      <Detail label="วันที่ส่งคำขอ" value={dateTime(selectedRequest.submittedAt)} />
                      <Detail label="ช่องทางรับเงิน" value={methodLabels[selectedRequest.paymentMethod]} />
                      <Detail label="บัญชีรับเงิน" value={selectedRequest.account} />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className="text-sm font-semibold">การดำเนินการ</p>
                    <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
                      <Detail label="ผู้ดำเนินการ" value={selectedRequest.processedBy ?? 'ยังไม่มีผู้ดำเนินการ'} />
                      <div className="space-y-1">
                        <p className="text-xs font-medium tracking-wide text-muted-foreground">หลักฐานการโอน</p>
                        {selectedRequest.transferProofUrl && selectedRequest.transferProofName ? (
                          <a
                            href={selectedRequest.transferProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                          >
                            <ExternalLink className="size-4" />
                            ดูหลักฐานการโอน
                          </a>
                        ) : <p className="text-sm font-medium text-muted-foreground">ยังไม่มีไฟล์แนบ</p>}
                      </div>
                    </div>
                  </section>

                  {selectedRequest.note && (
                    <section className="rounded-xl border border-border bg-accent/30 p-4">
                      <Detail label="หมายเหตุ" value={selectedRequest.note} />
                    </section>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={approvalRequest !== null}
          onOpenChange={(open) => {
            if (!open) {
              closeApprovalDialog()
            }
          }}
        >
          <DialogContent className="max-w-md gap-5 sm:max-w-md">
            <DialogHeader className="pr-8">
              <DialogTitle className="text-lg">แนบหลักฐานการโอน</DialogTitle>
              <DialogDescription>
                แนบไฟล์หลักฐานการโอนสำหรับคำขอ {approvalRequest?.id} ก่อนอนุมัติคำขอ
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label htmlFor="transfer-proof">ไฟล์หลักฐาน</Label>
              <label
                htmlFor="transfer-proof"
                onDragEnter={(event) => { event.preventDefault(); setIsDraggingProof(true) }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setIsDraggingProof(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setIsDraggingProof(false)
                  selectTransferProof(event.dataTransfer.files[0])
                }}
                className={`flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${isDraggingProof ? 'border-primary bg-primary/10' : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-accent/40'}`}
              >
                <Input
                  id="transfer-proof"
                  type="file"
                  accept="image/png,image/jpeg,application/pdf"
                  className="sr-only"
                  onChange={(event) => selectTransferProof(event.target.files?.[0])}
                />
                {transferProofName ? (
                  <>
                    <div className="rounded-full bg-primary/15 p-3 text-primary"><FileText className="size-6" /></div>
                    <p className="mt-3 max-w-full truncate font-medium">{transferProofName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">กดหรือลากไฟล์ใหม่เพื่อแทนที่</p>
                  </>
                ) : (
                  <>
                    <div className="rounded-full bg-primary/15 p-3 text-primary"><UploadCloud className="size-6" /></div>
                    <p className="mt-3 font-medium">ลากไฟล์มาวางที่นี่</p>
                    <p className="mt-1 text-sm text-muted-foreground">หรือกดเพื่อเลือกไฟล์</p>
                  </>
                )}
              </label>
              <p className="text-xs text-muted-foreground">รองรับไฟล์ PNG, JPG และ PDF</p>
              {transferProofError && <p className="text-xs text-destructive">{transferProofError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="approval-note">หมายเหตุสำหรับการอนุมัติ <span className="text-muted-foreground">(ไม่บังคับ)</span></Label>
              <Textarea
                id="approval-note"
                value={approvalNote}
                onChange={(event) => setApprovalNote(event.target.value)}
                placeholder="เช่น ตรวจสอบหลักฐานและข้อมูลบัญชีเรียบร้อยแล้ว"
                className="min-h-24 resize-none"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeApprovalDialog}>
                ยกเลิก
              </Button>
              <Button onClick={approveRequest} disabled={!transferProofName}>
                ยืนยันการอนุมัติ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={rejectionRequest !== null}
          onOpenChange={(open) => {
            if (!open) {
              setRejectionRequest(null)
              setRejectionNote('')
            }
          }}
        >
          <DialogContent className="max-w-md gap-5 sm:max-w-md">
            <DialogHeader className="pr-8">
              <DialogTitle className="text-lg">ปฏิเสธคำขอถอนเงิน</DialogTitle>
              <DialogDescription>ระบุเหตุผลที่ปฏิเสธสำหรับคำขอ {rejectionRequest?.id}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="rejection-note">เหตุผลที่ปฏิเสธ</Label>
              <Textarea
                id="rejection-note"
                value={rejectionNote}
                onChange={(event) => setRejectionNote(event.target.value)}
                placeholder="เช่น ชื่อเจ้าของบัญชีไม่ตรงกับข้อมูลที่ลงทะเบียนไว้"
                className="min-h-28 resize-none"
              />
              <p className="text-xs text-muted-foreground">หมายเหตุนี้จะแสดงในรายละเอียดคำขอ</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRejectionRequest(null); setRejectionNote('') }}>ยกเลิก</Button>
              <Button variant="destructive" onClick={rejectRequest} disabled={!rejectionNote.trim()}>ยืนยันการปฏิเสธ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}
