'use client'

import { useMemo, useState } from 'react'
import { Banknote, CheckCircle2, Clock3, Eye, MoreHorizontal, Search, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
}

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

  const pendingRequests = requests.filter((request) => request.status === 'pending')
  const awaitingPayment = requests.filter(
    (request) => request.status === 'pending' || request.status === 'approved',
  )
  const approvedToday = requests.filter(
    (request) => request.status === 'approved' && request.submittedAt.startsWith('2026-09-06'),
  )
  const rejectedToday = requests.filter(
    (request) => request.status === 'rejected' && request.submittedAt.startsWith('2026-09-06'),
  )

  function updateStatus(
    requestId: string,
    nextStatus: Exclude<WithdrawalStatus, 'pending'>,
    proofName?: string,
  ) {
    const updateRequest = (request: WithdrawalRequest): WithdrawalRequest =>
      request.id === requestId
        ? {
            ...request,
            status: nextStatus,
            processedBy: 'admin@readji.com',
            note: statusNotes[nextStatus],
            transferProofName: nextStatus === 'approved' ? proofName ?? request.transferProofName : request.transferProofName,
          }
        : request

    setRequests((current) => current.map(updateRequest))
    setSelectedRequest((current) => (current?.id === requestId ? updateRequest(current) : current))
  }

  function approveRequest() {
    if (!approvalRequest || !transferProofName) return
    updateStatus(approvalRequest.id, 'approved', transferProofName)
    closeApprovalDialog()
  }

  function closeApprovalDialog() {
    setApprovalRequest(null)
    setTransferProofName('')
  }

  return (
    <main className="mx-auto w-full space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Banknote className="size-6 text-primary" />
          คำขอถอนเงิน
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="รอตรวจสอบ"
          value={pendingRequests.length.toLocaleString('th-TH')}
          icon={<Clock3 className="size-5 text-amber-600" />}
          tone="amber"
        />
        <SummaryCard
          label="รอจ่ายเงิน"
          value={money(awaitingPayment.reduce((sum, request) => sum + request.netAmount, 0))}
          icon={<Banknote className="size-5 text-sky-600" />}
          tone="sky"
        />
        <SummaryCard
          label="อนุมัติวันนี้"
          value={approvedToday.length.toLocaleString('th-TH')}
          icon={<CheckCircle2 className="size-5 text-emerald-600" />}
          tone="emerald"
        />
        <SummaryCard
          label="ปฏิเสธวันนี้"
          value={rejectedToday.length.toLocaleString('th-TH')}
          icon={<XCircle className="size-5 text-red-600" />}
          tone="red"
        />
      </div>

      <Card>
        <CardHeader className="gap-4 border-b">
          <div className="flex flex-col gap-1">
            <CardTitle>รายการคำขอถอนเงิน</CardTitle>
            <p className="text-sm text-muted-foreground">
              แสดง {filteredRequests.length} จาก {requests.length} รายการ
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_10rem_10rem_9rem]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหารหัสคำขอหรือผู้ใช้งาน"
                aria-label="ค้นหาคำขอถอนเงิน"
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={(value) => setStatus(value as 'all' | WithdrawalStatus)}>
              <SelectTrigger className="w-full">
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
            <Select value={method} onValueChange={(value) => setMethod(value as 'all' | PaymentMethod)}>
              <SelectTrigger className="w-full">
                <SelectValue>{() => (method === 'all' ? 'ทุกช่องทาง' : methodLabels[method])}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกช่องทาง</SelectItem>
                {Object.entries(methodLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {() =>
                    ({ all: 'ทุกช่วงเวลา', today: 'วันนี้', '7d': '7 วันที่ผ่านมา', '30d': '30 วันที่ผ่านมา' })[
                      dateRange
                    ]
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกช่วงเวลา</SelectItem>
                <SelectItem value="today">วันนี้</SelectItem>
                <SelectItem value="7d">7 วันที่ผ่านมา</SelectItem>
                <SelectItem value="30d">30 วันที่ผ่านมา</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>คำขอ / ผู้ใช้งาน</TableHead>
                <TableHead className="text-right">ยอดที่ขอถอน</TableHead>
                <TableHead className="text-right">ค่าธรรมเนียม</TableHead>
                <TableHead className="text-right">ยอดสุทธิ</TableHead>
                <TableHead>ช่องทางรับเงิน</TableHead>
                <TableHead>วันที่ส่งคำขอ</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.length ? (
                filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="font-medium">{request.id}</div>
                      <div className="text-xs text-muted-foreground">
                        {request.user.displayName} · @{request.user.username}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{money(request.requestedAmount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{money(request.fee)}</TableCell>
                    <TableCell className="text-right font-medium">{money(request.netAmount)}</TableCell>
                    <TableCell>
                      <div>{methodLabels[request.paymentMethod]}</div>
                      <div className="text-xs text-muted-foreground">{request.account}</div>
                    </TableCell>
                    <TableCell>{dateTime(request.submittedAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusClasses[request.status]}>
                        {statusLabels[request.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon" aria-label={`จัดการ ${request.id}`} title="จัดการสถานะ" />}
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
                            <DropdownMenuItem variant="destructive" onClick={() => updateStatus(request.id, 'rejected')}>
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
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>รายละเอียดคำขอถอนเงิน {selectedRequest?.id}</DialogTitle>
            <DialogDescription>
              หน้าจอตัวอย่างสำหรับดูรายละเอียด โดยการอนุมัติและจ่ายเงินจะเชื่อมต่อกับ API ในขั้นตอนถัดไป
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail
                label="ผู้ใช้งาน"
                value={`${selectedRequest.user.displayName} (@${selectedRequest.user.username})`}
              />
              <Detail label="สถานะ" value={statusLabels[selectedRequest.status]} />
              <Detail label="ยอดที่ขอถอน" value={money(selectedRequest.requestedAmount)} />
              <Detail label="ค่าธรรมเนียมถอนเงิน" value={money(selectedRequest.fee)} />
              <Detail label="ยอดสุทธิ" value={money(selectedRequest.netAmount)} />
              <Detail
                label="ช่องทางรับเงิน"
                value={`${methodLabels[selectedRequest.paymentMethod]} · ${selectedRequest.account}`}
              />
              <Detail label="วันที่ส่งคำขอ" value={dateTime(selectedRequest.submittedAt)} />
              <Detail label="ผู้ดำเนินการ" value={selectedRequest.processedBy ?? 'ยังไม่มีผู้ดำเนินการ'} />
              {selectedRequest.transferProofName && <Detail label="หลักฐานการโอน" value={selectedRequest.transferProofName} />}
              {selectedRequest.note && (
                <div className="sm:col-span-2">
                  <Detail label="หมายเหตุ" value={selectedRequest.note} />
                </div>
              )}
            </div>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แนบหลักฐานการโอน</DialogTitle>
            <DialogDescription>
              แนบไฟล์หลักฐานการโอนสำหรับคำขอ {approvalRequest?.id} ก่อนอนุมัติคำขอ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="transfer-proof">ไฟล์หลักฐาน</Label>
            <Input
              id="transfer-proof"
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              onChange={(event) => setTransferProofName(event.target.files?.[0]?.name ?? '')}
            />
            <p className="text-xs text-muted-foreground">รองรับไฟล์ PNG, JPG และ PDF</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeApprovalDialog}>ยกเลิก</Button>
            <Button onClick={approveRequest} disabled={!transferProofName}>ยืนยันการอนุมัติ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: string
  icon: React.ReactNode
  tone: 'amber' | 'sky' | 'emerald' | 'red'
}) {
  const tones = {
    amber: 'bg-amber-50 dark:bg-amber-950/40',
    sky: 'bg-sky-50 dark:bg-sky-950/40',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40',
    red: 'bg-red-50 dark:bg-red-950/40',
  }
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className={`rounded-lg p-3 ${tones[tone]}`}>{icon}</div>
      </CardContent>
    </Card>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  )
}
