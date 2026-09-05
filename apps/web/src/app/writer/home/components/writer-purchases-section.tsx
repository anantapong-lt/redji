'use client'

import { useEffect, useState } from 'react'
import { ImageIcon, UserRound } from 'lucide-react'
import { GiTwoCoins } from 'react-icons/gi'
import { useAuth } from '@/components/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getWriterPurchases } from '@/controllers/writer.controller'
import type { WriterPurchasesResponse } from '@/interface/writer-purchase.interface'
import { userRole } from '@/interface/user.interface'
import { SITE_CONFIG } from '@/site.config'

const limits = [10, 20, 50, 100]
const numberFormat = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 })
const dateFormat = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  timeZone: 'Asia/Bangkok',
})

export function WriterPurchasesSection() {
  const { accessToken, user } = useAuth()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{
    data: WriterPurchasesResponse
    token: string
    userId: string
    page: number
    limit: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!accessToken || !user || user.role !== userRole.WRITER) {
      setResult(null)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setHasError(false)
    void getWriterPurchases(page, limit, accessToken, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ data, token: accessToken, userId: user.id, page, limit })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setHasError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [accessToken, user?.id, user?.role, page, limit, retry])

  const data = result?.token === accessToken && result?.userId === user?.id
    && result?.page === page && result?.limit === limit ? result?.data : null
  const loading = isLoading || (!data && !hasError)
  const pagination = data?.pagination

  return (
    <section className="readji-surface mt-6 overflow-hidden rounded-2xl" aria-labelledby="writer-purchases-title">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <h2 id="writer-purchases-title" className="text-lg font-bold">รายการซื้อตอนล่าสุด</h2>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="writer-purchases-limit">รายการต่อหน้า</label>
          <Select value={String(limit)} onValueChange={(value) => { setLimit(Number(value)); setPage(1) }}>
            <SelectTrigger id="writer-purchases-limit" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {limits.map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Table className="min-w-[760px]" aria-busy={loading}>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="px-5">รูปปก</TableHead>
            <TableHead className="px-4">ตอนที่</TableHead>
            <TableHead className="px-4">ตอน</TableHead>
            <TableHead className="px-4">ผู้ซื้อ</TableHead>
            <TableHead className="px-5">เวลาซื้อ</TableHead>
            <TableHead className="px-4 text-right">ราคา ({SITE_CONFIG.coinName})</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? Array.from({ length: limit }, (_, index) => (
            <TableRow key={index}>
              {Array.from({ length: 6 }, (_, cell) => (
                <TableCell key={cell} className="px-4 py-4"><Skeleton className="h-8 w-full min-w-12" /></TableCell>
              ))}
            </TableRow>
          )) : hasError ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center">
                <p role="alert" className="text-destructive">ไม่สามารถโหลดรายการซื้อตอนได้</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setRetry((value) => value + 1)}>ลองใหม่</Button>
              </TableCell>
            </TableRow>
          ) : !data?.purchases.length ? (
            <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">ยังไม่มีรายการซื้อตอน</TableCell></TableRow>
          ) : data.purchases.map((purchase) => (
            <TableRow key={purchase.id}>
              <TableCell className="px-5 py-3">
                <div className="flex h-16 w-12 items-center justify-center overflow-hidden rounded-lg bg-muted" title={purchase.story_title}>
                  {purchase.cover_url ? (
                    <img src={purchase.cover_url} alt={`ปก ${purchase.story_title}`} loading="lazy" className="size-full object-cover" />
                  ) : <ImageIcon aria-label={`ไม่มีรูปปก ${purchase.story_title}`} className="size-5 text-muted-foreground" />}
                </div>
              </TableCell>
              <TableCell className="px-4 tabular-nums">{Number(purchase.chapter_number)}</TableCell>
              <TableCell className="min-w-48 max-w-80 px-4 whitespace-normal break-words">{purchase.chapter_title}</TableCell>
              <TableCell className="px-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {purchase.buyer_avatar_url ? (
                      <img src={purchase.buyer_avatar_url} alt="" loading="lazy" className="size-full object-cover" />
                    ) : <UserRound aria-hidden="true" className="size-4 text-muted-foreground" />}
                  </span>
                  <span>{purchase.buyer_username}</span>
                </div>
              </TableCell>
              <TableCell className="px-5"><time dateTime={purchase.purchased_at}>{dateFormat.format(new Date(purchase.purchased_at))}</time></TableCell>
              <TableCell className="px-4 text-right tabular-nums">
                <span className="inline-flex items-center gap-1.5"><GiTwoCoins aria-hidden="true" className="size-4 shrink-0 text-primary" />{numberFormat.format(Number(purchase.price))}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!loading && !hasError && pagination && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
          <p className="text-sm text-muted-foreground">ทั้งหมด {numberFormat.format(pagination.total)} รายการ</p>
          <nav aria-label="หน้ารายการซื้อตอน" className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>ก่อนหน้า</Button>
            <span className="min-w-20 text-center text-sm" aria-live="polite">{pagination.page} / {Math.max(pagination.totalPages, 1)}</span>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.page + 1)}>ถัดไป</Button>
          </nav>
        </div>
      )}
    </section>
  )
}
