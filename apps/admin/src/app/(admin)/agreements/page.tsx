'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, FilePenLine, FileText, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminAuth } from '@/components/admin-auth-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RichTextEditor } from '../../../../../web/src/components/common/rich-text-editor'

type AgreementType = 'website' | 'writer'
type Agreement = { id: string; version: number; content_html: string; is_active: boolean; created_at: string }
const PAGE_SIZE = 10
const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

export default function AgreementsPage() {
  const { accessToken } = useAdminAuth()
  const [type, setType] = useState<AgreementType>('website')
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [page, setPage] = useState(1)
  const [contentHtml, setContentHtml] = useState('')
  const [editorKey, setEditorKey] = useState(0)
  const [previewAgreement, setPreviewAgreement] = useState<Agreement | null>(null)
  const [updatingAgreementId, setUpdatingAgreementId] = useState<string | null>(null)

  const load = async () => {
    if (!accessToken) return
    const response = await fetch(`${apiUrl}/admin/agreements/${type}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (response.ok) setAgreements((await response.json()).agreements)
  }
  useEffect(() => {
    setPage(1)
    void load()
  }, [accessToken, type])

  const create = async () => {
    const content_html = contentHtml.trim()
    if (!content_html || !accessToken) return
    const response = await fetch(`${apiUrl}/admin/agreements/${type}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_html }),
    })
    if (response.ok) {
      setContentHtml('')
      setEditorKey((value) => value + 1)
    }
    await load()
  }
  const setAgreementStatus = async (agreement: Agreement, isActive: boolean) => {
    if (!accessToken || updatingAgreementId) return
    setUpdatingAgreementId(agreement.id)
    try {
      const response = await fetch(`${apiUrl}/admin/agreements/${type}/${agreement.id}/status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      })
      const body = await response.json() as { message?: string }
      if (!response.ok) throw new Error(body.message ?? 'ไม่สามารถเปลี่ยนสถานะข้อตกลงได้')
      await load()
      toast.success(body.message ?? 'เปลี่ยนสถานะข้อตกลงเรียบร้อยแล้ว')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ไม่สามารถเปลี่ยนสถานะข้อตกลงได้')
    } finally {
      setUpdatingAgreementId(null)
    }
  }
  const edit = (agreement: Agreement) => {
    setContentHtml(agreement.content_html)
    setEditorKey((value) => value + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const totalPages = Math.max(1, Math.ceil(agreements.length / PAGE_SIZE))
  const currentRows = agreements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <main className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText />
            จัดการข้อตกลงการใช้งาน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={type} onValueChange={(value) => setType(value as AgreementType)}>
            <TabsList className="grid h-10 w-full grid-cols-2">
              <TabsTrigger value="website" className="data-active:!bg-primary data-active:!text-primary-foreground">
                ข้อตกลงเว็บไซต์
              </TabsTrigger>
              <TabsTrigger value="writer" className="data-active:!bg-primary data-active:!text-primary-foreground">
                ข้อตกลงนักเขียน
              </TabsTrigger>
            </TabsList>
            <TabsContent value={type} className="space-y-4">
              <RichTextEditor
                key={editorKey}
                id={`agreement-editor-${type}`}
                initialContent={contentHtml}
                onChange={setContentHtml}
                contentClassName="min-h-[40rem]"
              />
              <div className="flex justify-center pb-16">
                <Button onClick={() => void create()}>
                  <Plus />
                  สร้างเวอร์ชัน
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>เวอร์ชัน</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead>วันที่สร้าง</TableHead>
                        <TableHead className="text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentRows.map((agreement) => (
                        <TableRow key={agreement.id}>
                          <TableCell>v{agreement.version}</TableCell>
                          <TableCell>
                            <Switch
                              checked={agreement.is_active}
                              disabled={updatingAgreementId !== null}
                              onCheckedChange={(checked) => void setAgreementStatus(agreement, checked)}
                              aria-label={`${agreement.is_active ? 'ปิด' : 'เปิด'}ใช้งานเวอร์ชัน ${agreement.version}`}
                            />
                          </TableCell>
                          <TableCell>
                            {new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(
                              new Date(agreement.created_at),
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={<Button size="sm" variant="outline">จัดการ</Button>}
                              />
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => edit(agreement)}>
                                  <FilePenLine />
                                  แก้ไข
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setPreviewAgreement(agreement)}>
                                  <Eye />
                                  ดูตัวอย่าง
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-end gap-2 border-t p-3">
                    <Button
                      size="icon"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((value) => value - 1)}
                    >
                      <ChevronLeft />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {page} / {totalPages}
                    </span>
                    <Button
                      size="icon"
                      variant="outline"
                      disabled={page >= totalPages}
                      onClick={() => setPage((value) => value + 1)}
                    >
                      <ChevronRight />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
        <Dialog open={previewAgreement !== null} onOpenChange={(open) => !open && setPreviewAgreement(null)}>
          <DialogContent className="grid h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] sm:h-[min(90dvh,56rem)] sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>ตัวอย่างเวอร์ชัน {previewAgreement?.version}</DialogTitle>
            </DialogHeader>
            <div
              className="min-h-0 overflow-y-auto rounded-md border p-5 sm:p-8"
              dangerouslySetInnerHTML={{ __html: previewAgreement?.content_html ?? '' }}
            />
          </DialogContent>
        </Dialog>
      </Card>
    </main>
  )
}
