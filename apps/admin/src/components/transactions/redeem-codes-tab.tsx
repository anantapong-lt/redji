'use client'

/**
 * components/transactions/redeem-codes-tab.tsx — แท็บ "โค้ดส่วนลด/เติมเหรียญ" (2026-08-18, ใหม่)
 *
 * ปุ่ม "ใช้โค้ด" ในเนวบาร์ apps/web เดิมเป็น dead link — สร้างระบบโค้ดขึ้นมาให้ใช้งานได้จริง 3
 * ประเภท: เติมเหรียญทันที, โบนัส % เติมเงินครั้งถัดไป, และโค้ดชวนเพื่อน (ดู redeem.service.ts +
 * referral.service.ts ฝั่ง apps/api) หน้านี้ให้แอดมินสร้าง/แก้ไข/ปิดใช้งานโค้ด + ดูว่าใครแลกไปบ้าง
 * ("ยังอยู่ไหม" ตามที่ user ขอไว้กับหมวดหมู่ย่อยก่อนหน้านี้ — ใช้ pattern เดียวกัน: กด
 * "ดูประวัติการแลก" ขยายแถวโชว์รายชื่อ)
 *
 * 2026-08-18: โค้ดประเภท referral ไม่ได้สร้างผ่านหน้านี้ (auto-gen ต่อ user คนละใบตอนเข้าหน้า
 * "ชวนเพื่อน") — สร้างใหม่ผ่านฟอร์มนี้ไม่ได้ (ดู redeem-code-form-dialog.tsx) แต่ยังโผล่ในลิสต์นี้
 * ให้แอดมินดู/ปิดใช้งานได้เผื่อมีคนใช้ในทางที่ผิด
 *
 * ไม่มีปุ่มลบถาวร — ตั้งใจ (redeem_code_uses ผูก FK กับ redeem_codes ไว้ ลบแล้วประวัติเก่าจะพัง)
 * ใช้ "ปิดใช้งาน" แทนเสมอ เหมือนหมวดหมู่/แนวทางอื่นในระบบนี้
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RedeemCodeFormDialog } from './redeem-code-form-dialog'
import { api } from '@/lib/api'
import { formatThaiDateTime } from '@/lib/utils'
import type { RedeemCodeAdminRow, RedeemCodeUseRow, Pagination } from '@/types'

const USE_STATUS_LABEL: Record<string, string> = {
  pending: 'รอใช้สิทธิ์',
  consumed: 'ใช้แล้ว',
  expired: 'หมดเวลา',
  active: 'เป็นเพื่อนที่ชวนแล้ว',
}

function RedeemCodeUsesList({ codeId }: { codeId: string }) {
  const query = useQuery({
    queryKey: ['admin', 'redeem-code-uses', codeId],
    queryFn: () => api.get<{ data: RedeemCodeUseRow[]; pagination: Pagination }>(`/admin/redeem-codes/${codeId}/uses?limit=50`),
  })

  const rows = query.data?.data ?? []

  return (
    <div className="border-t border-border bg-muted/30 px-4 py-3">
      {query.isLoading ? (
        <p className="py-3 text-center text-xs text-muted-foreground">กำลังโหลด...</p>
      ) : rows.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">ยังไม่มีใครแลกโค้ดนี้เลย</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-lg bg-card px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-foreground">{u.user.display_name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">@{u.user.u_name}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  แลกเมื่อ {formatThaiDateTime(u.redeemed_at)}
                  {u.status === 'consumed' && u.consumed_at && ` · ใช้สิทธิ์เมื่อ ${formatThaiDateTime(u.consumed_at)}`}
                  {u.status === 'pending' && u.expires_at && ` · หมดเวลา ${formatThaiDateTime(u.expires_at)}`}
                </p>
              </div>
              <span
                className={
                  u.status === 'consumed' || u.status === 'active'
                    ? 'shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : u.status === 'pending'
                      ? 'shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                      : 'shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground'
                }
              >
                {USE_STATUS_LABEL[u.status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RedeemCodesTab() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RedeemCodeAdminRow | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'redeem-codes', page],
    queryFn: () => api.get<{ data: RedeemCodeAdminRow[]; pagination: Pagination }>(`/admin/redeem-codes?page=${page}&limit=30`),
  })

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'redeem-codes'] })
  }

  const rows = query.data?.data ?? []
  const pagination = query.data?.pagination

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          โค้ดที่ผู้ใช้กรอกผ่านปุ่ม &quot;ใช้โค้ด&quot; ในเนวบาร์ — เติมเหรียญทันที หรือเปิดสิทธิ์โบนัส %
          รอเติมเงินครั้งถัดไป
        </p>
        <Button
          type="button"
          className="h-9 shrink-0 gap-1.5"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="size-4" />
          สร้างโค้ด
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {query.isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">ยังไม่มีโค้ดในระบบ — กด &quot;สร้างโค้ด&quot; เพื่อเริ่มต้น</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="border-b border-border last:border-0">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-mono text-sm font-bold text-foreground">{row.code}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {row.type === 'instant_coins'
                        ? `เติม ${Number(row.value).toLocaleString()} เหรียญ`
                        : row.type === 'topup_bonus_percent'
                          ? `โบนัส +${Number(row.value)}%`
                          : `ชวนเพื่อน — เพื่อนได้ 10 เหรียญ, เจ้าของได้ ${Number(row.value)}%/ครั้งเติม`}
                    </span>
                    {row.type === 'referral' && (
                      <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                        auto-gen
                      </span>
                    )}
                    {row.status === 'disabled' && (
                      <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">ปิดใช้งาน</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ใช้ไปแล้ว {row.used_count}{row.max_uses !== null ? ` / ${row.max_uses}` : ''} ครั้ง · จำกัด {row.max_uses_per_user} ครั้ง/คน
                    {row.valid_until && ` · หมดอายุ ${formatThaiDateTime(row.valid_until)}`}
                    {row.label && ` · ${row.label}`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                  className="flex shrink-0 cursor-pointer items-center gap-1 text-sm text-primary hover:underline"
                >
                  {expandedId === row.id ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  ดูประวัติการแลก
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditing(row)
                    setDialogOpen(true)
                  }}
                  className="flex shrink-0 cursor-pointer items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Pencil className="size-3.5" />
                  แก้ไข
                </button>
              </div>

              {expandedId === row.id && <RedeemCodeUsesList codeId={row.id} />}
            </div>
          ))
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-8 px-3 text-xs">
            ก่อนหน้า
          </Button>
          <span className="text-xs text-muted-foreground">
            {pagination.page} / {pagination.pages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
            className="h-8 px-3 text-xs"
          >
            ถัดไป
          </Button>
        </div>
      )}

      <RedeemCodeFormDialog code={editing} open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={refetch} />
    </div>
  )
}
