'use client'

import { useCallback, useEffect, useState } from 'react'
import { Ban, ChevronLeft, ChevronRight, Plus, Search, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
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
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface AdminAccount {
  id: string
  email: string
  username: string
  display_name: string
  status: 'active' | 'banned'
  email_verified_at: string | null
  last_login_at: string | null
  created_at: string
}

interface AdminAccountsResponse {
  accounts: AdminAccount[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

interface CreateAdminForm {
  display_name: string
  username: string
  email: string
  password: string
  confirm_password: string
}

type AdminAccountStatus = AdminAccount['status']

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const emptyForm: CreateAdminForm = {
  display_name: '',
  username: '',
  email: '',
  password: '',
  confirm_password: '',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function AdminAccountPage() {
  const { accessToken } = useAdminAuth()
  const [data, setData] = useState<AdminAccountsResponse | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<CreateAdminForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [statusChange, setStatusChange] = useState<{ account: AdminAccount; nextStatus: AdminAccountStatus } | null>(null)
  const [changingStatus, setChangingStatus] = useState(false)

  const loadAccounts = useCallback(async () => {
    if (!accessToken) return

    setLoading(true)
    setError(null)
    const query = new URLSearchParams({ page: String(page), limit: '20' })
    if (submittedSearch) query.set('search', submittedSearch)

    try {
      const response = await fetch(`${apiUrl}/admin/accounts?${query}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      })
      const body = (await response.json().catch(() => null)) as AdminAccountsResponse | { message?: string } | null
      if (!response.ok) {
        throw new Error(body && 'message' in body ? body.message : 'ไม่สามารถโหลดรายการแอดมินได้')
      }
      setData(body as AdminAccountsResponse)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ไม่สามารถโหลดรายการแอดมินได้')
    } finally {
      setLoading(false)
    }
  }, [accessToken, page, submittedSearch])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  const applySearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setSubmittedSearch(search.trim())
  }

  const updateForm = <Key extends keyof CreateAdminForm>(key: Key, value: CreateAdminForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const closeDialog = () => {
    if (saving) return
    setDialogOpen(false)
    setForm(emptyForm)
    setFormError(null)
  }

  const submitAdmin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!accessToken) return
    if (form.password !== form.confirm_password) {
      setFormError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const response = await fetch(`${apiUrl}/admin/accounts`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          display_name: form.display_name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      })
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) throw new Error(body?.message ?? 'ไม่สามารถเพิ่มแอดมินได้')

      setDialogOpen(false)
      setForm(emptyForm)
      toast.success('เพิ่มบัญชีแอดมินเรียบร้อยแล้ว')

      if (page === 1 && !submittedSearch) {
        await loadAccounts()
      } else {
        setSearch('')
        setSubmittedSearch('')
        setPage(1)
      }
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'ไม่สามารถเพิ่มแอดมินได้')
    } finally {
      setSaving(false)
    }
  }

  const submitStatusChange = async () => {
    if (!accessToken || !statusChange || changingStatus) return

    setChangingStatus(true)
    try {
      const response = await fetch(`${apiUrl}/admin/accounts/${statusChange.account.id}/status`, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ status: statusChange.nextStatus }),
      })
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) throw new Error(body?.message ?? 'ไม่สามารถเปลี่ยนสถานะบัญชีแอดมินได้')

      toast.success(statusChange.nextStatus === 'banned' ? 'ปิดใช้งานบัญชีแอดมินเรียบร้อยแล้ว' : 'เปิดใช้งานบัญชีแอดมินเรียบร้อยแล้ว')
      setStatusChange(null)
      await loadAccounts()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'ไม่สามารถเปลี่ยนสถานะบัญชีแอดมินได้')
    } finally {
      setChangingStatus(false)
    }
  }

  return (
    <main className="mx-auto w-full p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShieldCheck className="size-6 text-primary" />
          บัญชีแอดมิน
        </h1>
        <p className="text-sm text-muted-foreground">จัดการบัญชีที่มีสิทธิ์เข้าใช้งานระบบหลังบ้าน</p>
      </div>

      <Card>
        <CardHeader className="gap-4 border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>
              {data
                ? `แอดมินทั้งหมด ${data.pagination.total.toLocaleString('th-TH')} รายการ`
                : 'กำลังโหลดรายการแอดมิน'}
            </CardTitle>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus />
              เพิ่มแอดมิน
            </Button>
          </div>
          <form onSubmit={applySearch} className="flex w-full gap-2 sm:max-w-md">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาชื่อ, Username หรืออีเมล"
              aria-label="ค้นหาแอดมิน"
            />
            <Button type="submit" variant="outline" size="icon" aria-label="ค้นหา">
              <Search />
            </Button>
          </form>
        </CardHeader>

        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-sm text-destructive">{error}</div>
          ) : (
            <Table className="min-w-200">
              <TableHeader>
                <TableRow>
                  <TableHead>แอดมิน</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>วันที่เพิ่ม</TableHead>
                  <TableHead>เข้าใช้ล่าสุด</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-9 w-52" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="ml-auto h-8 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.accounts.length ? (
                  data.accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div className="font-medium">{account.display_name}</div>
                        <div className="text-xs text-muted-foreground">{account.email}</div>
                      </TableCell>
                      <TableCell>@{account.username}</TableCell>
                      <TableCell>
                        <Badge variant={account.status === 'active' ? 'secondary' : 'destructive'}>
                          {account.status === 'active' ? 'ใช้งาน' : 'ถูกแบน'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(account.created_at)}</TableCell>
                      <TableCell>{account.last_login_at ? formatDate(account.last_login_at) : 'ยังไม่เคยเข้าใช้งาน'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={account.status === 'active' ? 'destructive' : 'outline'}
                          onClick={() => setStatusChange({
                            account,
                            nextStatus: account.status === 'active' ? 'banned' : 'active',
                          })}
                        >
                          {account.status === 'active' ? <Ban /> : <ShieldCheck />}
                          {account.status === 'active' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      ไม่พบแอดมินที่ตรงกับเงื่อนไข
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>

        <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            หน้า {data?.pagination.page ?? 1} จาก {data?.pagination.totalPages ?? 1}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              <ChevronLeft />
              ก่อนหน้า
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || !data || page >= data.pagination.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              ถัดไป
              <ChevronRight />
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>เพิ่มแอดมินใหม่</DialogTitle>
            <DialogDescription>บัญชีใหม่จะสามารถเข้าสู่ระบบหลังบ้านได้ทันที</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAdmin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="admin-display-name">ชื่อที่แสดง</Label>
              <Input
                id="admin-display-name"
                value={form.display_name}
                onChange={(event) => updateForm('display_name', event.target.value)}
                required
                maxLength={100}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-username">Username</Label>
              <Input
                id="admin-username"
                value={form.username}
                onChange={(event) => updateForm('username', event.target.value)}
                required
                minLength={3}
                maxLength={30}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">ความยาว 3–30 ตัวอักษร</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-email">อีเมล</Label>
              <Input
                id="admin-email"
                type="email"
                value={form.email}
                onChange={(event) => updateForm('email', event.target.value)}
                required
                maxLength={320}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="admin-password">รหัสผ่าน</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={form.password}
                  onChange={(event) => updateForm('password', event.target.value)}
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-confirm-password">ยืนยันรหัสผ่าน</Label>
                <Input
                  id="admin-confirm-password"
                  type="password"
                  value={form.confirm_password}
                  onChange={(event) => updateForm('confirm_password', event.target.value)}
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร</p>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'กำลังเพิ่ม...' : 'เพิ่มแอดมิน'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(statusChange)} onOpenChange={(open) => {
        if (!open && !changingStatus) setStatusChange(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{statusChange?.nextStatus === 'banned' ? 'ยืนยันการปิดใช้งานบัญชีแอดมิน' : 'ยืนยันการเปิดใช้งานบัญชีแอดมิน'}</DialogTitle>
            <DialogDescription>
              {statusChange?.nextStatus === 'banned'
                ? `บัญชี ${statusChange?.account.display_name ?? ''} จะไม่สามารถเข้าสู่ระบบหลังบ้านได้จนกว่าจะเปิดใช้งานอีกครั้ง`
                : `บัญชี ${statusChange?.account.display_name ?? ''} จะสามารถเข้าสู่ระบบหลังบ้านได้อีกครั้ง`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={changingStatus} onClick={() => setStatusChange(null)}>
              ยกเลิก
            </Button>
            <Button
              type="button"
              variant={statusChange?.nextStatus === 'banned' ? 'destructive' : 'default'}
              disabled={changingStatus}
              onClick={() => void submitStatusChange()}
            >
              {changingStatus ? 'กำลังบันทึก...' : statusChange?.nextStatus === 'banned' ? 'ยืนยันปิดใช้งาน' : 'ยืนยันเปิดใช้งาน'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
