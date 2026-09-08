'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertCircle, Banknote, CheckCircle2, CircleX, Clock3, Landmark, RefreshCw, WalletCards } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { GiTwoCoins } from 'react-icons/gi'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth/auth-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { WITHDRAWAL_STATUS, WITHDRAWAL_STATUS_LABEL, type WithdrawalStatus } from '@/constants/withdrawal.constant'
import { createWriterWithdrawal, getBankConfigs, getWriterWithdrawals } from '@/controllers/writer.controller'
import type { BankConfig } from '@/interface/writer-bank-account.interface'
import type { WriterWithdrawalsResponse } from '@/interface/writer-withdrawal.interface'
import { SITE_CONFIG } from '@/site.config'

const PAGE_LIMIT = 10
const amountFormat = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateFormat = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Bangkok',
})

function displayAmount(amount: string) {
  return amountFormat.format(Number(amount))
}

function maskedAccountNumber(accountNumber: string) {
  return `•••• ${accountNumber.slice(-4)}`
}

function statusStyle(status: WithdrawalStatus) {
  if (status === WITHDRAWAL_STATUS.PAID) return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
  if (status === WITHDRAWAL_STATUS.APPROVED) return 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400'
  if (status === WITHDRAWAL_STATUS.REJECTED) return 'border-destructive/20 bg-destructive/10 text-destructive'
  return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400'
}

function statusIcon(status: WithdrawalStatus) {
  if (status === WITHDRAWAL_STATUS.PAID) return CheckCircle2
  if (status === WITHDRAWAL_STATUS.REJECTED) return CircleX
  return status === WITHDRAWAL_STATUS.APPROVED ? Landmark : Clock3
}

function PageSkeleton() {
  return (
    <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-9 w-44" />
        <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-44 lg:col-span-2" /><Skeleton className="h-44" /></div>
        <Skeleton className="h-80 w-full" />
      </div>
    </main>
  )
}

export function WriterWithdrawals() {
  const router = useRouter()
  const { accessToken, refresh, status } = useAuth()
  const [data, setData] = useState<WriterWithdrawalsResponse | null>(null)
  const [banks, setBanks] = useState<BankConfig[]>([])
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function load() {
    if (!accessToken) return
    setIsLoading(true)
    setLoadError(null)
    try {
      const [withdrawals, bankResult] = await Promise.all([
        getWriterWithdrawals(page, PAGE_LIMIT, accessToken),
        getBankConfigs(accessToken),
      ])
      setData(withdrawals)
      setBanks(bankResult.banks)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลการถอนเงินได้')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!accessToken) {
      if (status !== 'loading') setIsLoading(false)
      return
    }
    void load()
    // load is intentionally scoped to the current token and page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, page, status])

  const bank = useMemo(
    () => banks.find((item) => item.code === data?.bank_account?.bank_code) ?? null,
    [banks, data?.bank_account?.bank_code],
  )
  const requestedAmount = Number(amount)
  const commissionAmount = data && Number.isFinite(requestedAmount)
    ? Math.round(requestedAmount * Number(data.commission_percent) / 100 * 100) / 100
    : 0
  const netAmount = Math.max(0, requestedAmount - commissionAmount)
  const canRequest = Boolean(
    data?.withdrawals_enabled
    && data.bank_account?.application_status === 'approve'
    && Number(data.balance) > 0,
  )

  async function submitWithdrawal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!accessToken || !data || isSubmitting) return
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || requestedAmount > Number(data.balance)) {
      toast.error('กรุณาระบุยอดถอนที่ไม่เกินยอดคงเหลือ')
      return
    }
    setIsSubmitting(true)
    try {
      await createWriterWithdrawal(amount, accessToken)
      toast.success('ส่งคำขอถอนเงินเรียบร้อยแล้ว')
      setAmount('')
      setIsDialogOpen(false)
      await Promise.all([load(), refresh()])
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ไม่สามารถส่งคำขอถอนเงินได้')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading && !data) return <PageSkeleton />

  if (loadError && !data) {
    return (
      <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto flex min-h-72 max-w-6xl flex-col items-center justify-center text-center">
          <AlertCircle className="size-8 text-destructive" />
          <p className="mt-3 font-semibold">{loadError}</p>
          <Button className="mt-4" onClick={() => void load()}><RefreshCw />ลองใหม่</Button>
        </div>
      </main>
    )
  }

  if (!data) return null

  const account = data.bank_account
  const pageStart = data.pagination.total === 0 ? 0 : (data.pagination.page - 1) * data.pagination.limit + 1
  const pageEnd = Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)

  return (
    <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.025em] md:text-3xl">ถอนเงิน</h1>
            <p className="mt-1 text-sm text-muted-foreground">จัดการยอดรายได้และติดตามสถานะคำขอถอนเงิน</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} disabled={!canRequest}><Banknote />ถอนเงิน</Button>
        </div>

        {!data.withdrawals_enabled && (
          <div className="mt-5 flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>ระบบถอนเงินยังไม่เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ</p>
          </div>
        )}

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <article className="readji-surface rounded-2xl bg-card p-5 lg:col-span-2">
            <p className="text-sm text-muted-foreground">ยอดที่ถอนได้</p>
            <p className="mt-2 flex items-center gap-2 text-3xl font-bold tabular-nums text-primary">
              <GiTwoCoins className="size-7 shrink-0" />
              {displayAmount(data.balance)}
              <span className="text-base font-medium text-muted-foreground">{SITE_CONFIG.coinName}</span>
            </p>
            <p className="mt-3 text-xs text-muted-foreground">ค่าคอมมิชชันเมื่อถอน {displayAmount(data.commission_percent)}% และระบบจะคำนวณยอดสุทธิให้ก่อนยืนยัน</p>
          </article>

          <article className="readji-surface rounded-2xl bg-card p-5">
            <div className="flex items-center gap-2"><WalletCards className="size-5 text-primary" /><h2 className="font-bold">บัญชีรับเงิน</h2></div>
            {account ? (
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  {bank && <img src={`${SITE_CONFIG.apiUrl}/writer/${bank.logo}`} alt="" className="size-7 object-contain" />}
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{bank?.name ?? account.bank_code}</p><p className="text-sm text-muted-foreground">{maskedAccountNumber(account.account_number)}</p></div>
                </div>
                <Badge variant="outline" className={`mt-3 ${account.application_status === 'approve' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400'}`}>
                  {account.application_status === 'approve' ? 'บัญชีได้รับการอนุมัติ' : account.application_status === 'reject' ? 'บัญชีไม่ผ่านการอนุมัติ' : 'รอตรวจสอบบัญชี'}
                </Badge>
              </div>
            ) : <p className="mt-4 text-sm text-muted-foreground">ยังไม่มีบัญชีธนาคารสำหรับรับเงิน</p>}
          </article>
        </section>

        <section className="readji-surface mt-6 overflow-hidden rounded-2xl bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div><h2 className="font-bold">ประวัติการถอนเงิน</h2><p className="mt-0.5 text-sm text-muted-foreground">{data.pagination.total} รายการ</p></div>
            {isLoading && <RefreshCw className="size-4 animate-spin text-muted-foreground" />}
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>วันที่ส่งคำขอ</TableHead><TableHead>ยอดที่ขอถอน</TableHead><TableHead>ค่าคอมมิชชัน</TableHead><TableHead>ยอดรับสุทธิ</TableHead><TableHead>สถานะ</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.requests.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-40 text-center text-muted-foreground">ยังไม่มีประวัติการถอนเงิน</TableCell></TableRow>
              ) : data.requests.map((request) => {
                const StatusIcon = statusIcon(request.status)
                return <TableRow key={request.id}>
                  <TableCell><p>{dateFormat.format(new Date(request.requested_at))}</p>{request.note && <p className="mt-1 max-w-48 truncate text-xs text-muted-foreground" title={request.note}>{request.note}</p>}</TableCell>
                  <TableCell className="font-medium tabular-nums">{displayAmount(request.requested_amount)}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{displayAmount(request.commission_amount)}</TableCell>
                  <TableCell className="font-bold tabular-nums">{displayAmount(request.net_amount)}</TableCell>
                  <TableCell><Badge variant="outline" className={statusStyle(request.status)}><StatusIcon className="size-3.5" />{WITHDRAWAL_STATUS_LABEL[request.status]}</Badge></TableCell>
                </TableRow>
              })}
            </TableBody>
          </Table>
          {data.pagination.total_pages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-sm text-muted-foreground">
              <span>แสดง {pageStart}–{pageEnd} จาก {data.pagination.total} รายการ</span>
              <div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => current - 1)}>ก่อนหน้า</Button><Button size="sm" variant="outline" disabled={page >= data.pagination.total_pages || isLoading} onClick={() => setPage((current) => current + 1)}>ถัดไป</Button></div>
            </div>
          )}
        </section>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setAmount('') }}>
        <DialogContent className="gap-5 sm:max-w-md">
          <DialogHeader><DialogTitle>ยืนยันการถอนเงิน</DialogTitle><DialogDescription>ยอดที่ขอถอนจะถูกกันไว้ระหว่างรอผู้ดูแลตรวจสอบ</DialogDescription></DialogHeader>
          <form onSubmit={submitWithdrawal} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="withdrawal-amount">จำนวนที่ต้องการถอน ({SITE_CONFIG.coinName})</Label><Input id="withdrawal-amount" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0.00" autoFocus /></div>
            <div className="rounded-xl bg-muted/60 p-4 text-sm"><div className="flex justify-between gap-4"><span className="text-muted-foreground">ยอดที่ขอถอน</span><span className="tabular-nums">{displayAmount(Number.isFinite(requestedAmount) ? String(requestedAmount) : '0')}</span></div><div className="mt-2 flex justify-between gap-4"><span className="text-muted-foreground">ค่าคอมมิชชัน ({displayAmount(data.commission_percent)}%)</span><span className="tabular-nums">-{displayAmount(String(commissionAmount))}</span></div><div className="mt-3 flex justify-between gap-4 border-t pt-3 font-bold"><span>ยอดที่จะได้รับ</span><span className="tabular-nums text-primary">{displayAmount(String(netAmount))} {SITE_CONFIG.coinName}</span></div></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>ยกเลิก</Button><Button type="submit" disabled={isSubmitting || !amount}>{isSubmitting ? 'กำลังส่งคำขอ...' : 'ยืนยันการถอนเงิน'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}
