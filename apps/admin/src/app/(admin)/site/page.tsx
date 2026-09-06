'use client'

import { useEffect, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { useAdminAuth } from '@/components/admin-auth-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

type Package = { amount: string; bonus: string }
interface Config {
  site: { name: string; tagline: string; description: string; site_url: string; admin_url: string; coin_name: string }
  topup: { packages: Package[] }
  withdrawal: { commission_percent: string }
  features: Record<'registration' | 'writer_application' | 'comments' | 'topup' | 'withdrawals', boolean>
}

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const featureLabels: Record<keyof Config['features'], string> = {
  registration: 'เปิดให้สมัครสมาชิก',
  writer_application: 'เปิดรับสมัครนักเขียน',
  comments: 'เปิดระบบความคิดเห็น',
  topup: 'เปิดระบบเติมเงิน',
  withdrawals: 'เปิดระบบถอนเงิน',
}

export default function SiteSettingsPage() {
  const { accessToken } = useAdminAuth()
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    void fetch(`${apiUrl}/admin/site`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('ไม่สามารถโหลดการตั้งค่าเว็บไซต์ได้')
        setConfig((await response.json()) as Config)
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'))
      .finally(() => setLoading(false))
  }, [accessToken])

  const updateSite = (key: keyof Config['site'], value: string) =>
    setConfig((current) => current && { ...current, site: { ...current.site, [key]: value } })
  const updateFeature = (key: keyof Config['features'], value: boolean) =>
    setConfig((current) => current && { ...current, features: { ...current.features, [key]: value } })
  const updatePackage = (index: number, key: keyof Package, value: string) =>
    setConfig(
      (current) =>
        current && {
          ...current,
          topup: {
            packages: current.topup.packages.map((item, itemIndex) =>
              itemIndex === index ? { ...item, [key]: value } : item,
            ),
          },
        },
    )

  async function save() {
    if (!accessToken || !config) return
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`${apiUrl}/admin/site`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
        body: JSON.stringify(config),
      })
      if (!response.ok) throw new Error('ไม่สามารถบันทึกการตั้งค่าเว็บไซต์ได้')
      toast.success('บันทึกการตั้งค่าเรียบร้อยแล้ว')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ไม่สามารถบันทึกการตั้งค่าได้')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="w-full max-w-none space-y-6 p-6" aria-busy="true">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-96 max-w-[70vw]" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-72" /></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 5 }, (_, index) => <div className="space-y-2" key={index}><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>)}
            <div className="space-y-2 md:col-span-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-24 w-full" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-6 w-52" /><Skeleton className="h-4 w-80" /></CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }, (_, index) => <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3" key={index}><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="size-10" /></div>)}
            <Skeleton className="h-10 w-36" />
          </CardContent>
        </Card>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><Skeleton className="h-6 w-36" /><Skeleton className="h-4 w-80" /></CardHeader><CardContent><Skeleton className="h-10 w-56" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-44" /></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-5 w-40" /><Skeleton className="h-5 w-40" /><Skeleton className="h-5 w-40" /><Skeleton className="h-5 w-40" /></CardContent></Card>
        </div>
      </main>
    )
  }
  if (!config) return <main className="w-full max-w-none p-6"><p className="rounded-md border p-4">{message ?? 'ไม่สามารถโหลดการตั้งค่าเว็บไซต์ได้'}</p></main>
  return (
    <main className="w-full max-w-none space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">ตั้งค่าเว็บไซต์</h1>
          <p className="text-muted-foreground">กำหนดข้อมูลหลัก ระบบเติมเงิน ค่าคอมมิชชัน และฟีเจอร์</p>
        </div>
        <Button onClick={() => void save()} disabled={saving}>
          <Save className="mr-2 size-4" />
          {saving ? 'กำลังบันทึก...' : 'บันทึกทั้งหมด'}
        </Button>
      </div>
      {message && <p className="rounded-md border p-3 text-sm">{message}</p>}
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลเว็บไซต์</CardTitle>
          <CardDescription>ข้อมูลที่ใช้แสดงบนเว็บไซต์และลิงก์ระบบ</CardDescription>
        </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
          {(
            [
              ['name', 'ชื่อเว็บไซต์'],
              ['tagline', 'คำโปรย'],
              ['site_url', 'URL เว็บไซต์'],
              ['admin_url', 'URL Admin'],
              ['coin_name', 'ชื่อเหรียญ'],
            ] as const
          ).map(([key, label]) => (
            <div className="space-y-2" key={key}>
              <Label>{label}</Label>
              <Input value={config.site[key]} onChange={(event) => updateSite(key, event.target.value)} />
            </div>
          ))}
          <div className="space-y-2 md:col-span-2">
            <Label>คำอธิบายเว็บไซต์</Label>
            <Textarea
              value={config.site.description}
              onChange={(event) => updateSite('description', event.target.value)}
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>แพ็กเกจเติมเงินและโบนัส</CardTitle>
          <CardDescription>จำนวนเงินที่ผู้ใช้เลือกเติม พร้อมโบนัสเหรียญเพิ่มเติม</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {config.topup.packages.map((item, index) => (
            <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3" key={`${index}-${item.amount}`}>
              <div className="space-y-2">
                <Label>จำนวนเงิน</Label>
                <Input
                  inputMode="decimal"
                  value={item.amount}
                  onChange={(event) => updatePackage(index, 'amount', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>โบนัส</Label>
                <Input
                  inputMode="decimal"
                  value={item.bonus}
                  onChange={(event) => updatePackage(index, 'bonus', event.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setConfig({
                    ...config,
                    topup: { packages: config.topup.packages.filter((_, itemIndex) => itemIndex !== index) },
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              setConfig({ ...config, topup: { packages: [...config.topup.packages, { amount: '', bonus: '0' }] } })
            }
          >
            <Plus className="mr-2 size-4" />
            เพิ่มแพ็กเกจ
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>การถอนเงิน</CardTitle>
          <CardDescription>คอมมิชชันจะถูกนำไปใช้เมื่อมีการถอนเงินเท่านั้น</CardDescription>
        </CardHeader>
        <CardContent className="max-w-sm space-y-2">
          <Label>คอมมิชชัน (%)</Label>
          <Input
            inputMode="decimal"
            value={config.withdrawal.commission_percent}
            onChange={(event) => setConfig({ ...config, withdrawal: { commission_percent: event.target.value } })}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>เปิด–ปิดฟีเจอร์</CardTitle>
        </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
          {(Object.keys(featureLabels) as (keyof Config['features'])[]).map((key) => (
            <label className="flex items-center gap-3" key={key}>
              <Checkbox
                checked={config.features[key]}
                onCheckedChange={(checked) => updateFeature(key, checked === true)}
              />
              <span>{featureLabels[key]}</span>
            </label>
          ))}
        </CardContent>
      </Card>
    </main>
  )
}
