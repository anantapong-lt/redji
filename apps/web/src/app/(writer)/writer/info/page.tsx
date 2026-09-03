'use client'

/**
 * app/(writer)/writer/info/page.tsx — "ข้อมูลนักเขียน" (2026-07-30, แก้รอบ 3 — ต่อ backend จริง)
 *
 * เข้าได้ทุก level (ไม่ต้องเป็นนักเขียนจริงก่อน — ดู proxy.ts) ใช้กรอกข้อมูลส่งขอเป็นนักเขียน
 * หรือดูสถานะ/ข้อมูลที่เคยส่งไปแล้ว
 *
 * 2026-07-30 แก้รอบ 3: ต่อ GET/POST /users/me/writer-application จริงแล้ว (เขียนลงตาราง
 * user_detail) แทนที่ writer-application.store.ts เดิมที่ mock ทั้งหมด — เหลือแค่
 * onboardingConfirmed (modal ครั้งแรก) ที่ยังเป็น client-only state ต่อไป เพราะไม่มีความหมาย
 * ฝั่ง server เลย (ดู hooks/use-writer-application.ts)
 *
 * สถานะที่เป็นไปได้ (จาก user_detail.status):
 * - ยังไม่เคยส่ง (application === null) → ฟอร์มว่าง กรอกได้
 * - pending → ล็อกฟอร์ม รอแอดมินตรวจสอบ (ไม่ว่าเป็นใบสมัครใหม่หรือใบแก้ไข)
 * - approve → ล็อกฟอร์ม แต่กด "แก้ไขข้อมูล" เพื่อปลดล็อกชั่วคราวได้ (2026-08-18 แก้ — เดิมล็อกถาวร
 *   ห้ามแก้ไขเลยไม่ว่ากรณีใด ตอนนี้ user ขอให้แก้ไขได้จริง โดยการแก้ไขแต่ละครั้งสร้างแถวใหม่ใน
 *   user_detail สถานะ pending ใช้ pattern เดียวกับตอน resubmit หลัง rejected — backend
 *   (submitWriterApplication) ตัดสินเองว่าเป็น application_type='edit' จาก level>=6 ไม่ต้องส่งมาเอง
 *   ระหว่างรอตรวจสอบการแก้ไข **จะขอถอนเงินไม่ได้** จนกว่าแอดมินจะอนุมัติ (ดู requestWithdrawal ใน
 *   writer.service.ts — บล็อกด้วย PENDING_INFO_EDIT) — การแก้ไขที่อนุมัติแล้วไม่เลื่อน level ซ้ำ
 * - rejected → ไม่ล็อก โชว์เหตุผลที่ถูกปฏิเสธ ให้แก้ไข+ส่งใหม่ได้ทันที (ทั้งใบสมัครใหม่และใบแก้ไข)
 */

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CircleCheck, Clock3, CircleX, Circle, User, Landmark, Lock, PenLine, ShieldCheck } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useUser } from '@/store/auth.store'
import { useWriterOnboardingStore, useOnboardingConfirmed } from '@/store/writer-application.store'
import { useMyWriterApplication, type WriterApplication } from '@/hooks/use-writer-application'

const INPUT_CLASS =
  'h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60'

const BANKS = [
  'ธนาคารกรุงเทพ',
  'ธนาคารกสิกรไทย',
  'ธนาคารไทยพาณิชย์',
  'ธนาคารกรุงไทย',
  'ธนาคารกรุงศรีอยุธยา',
  'ธนาคารทหารไทยธนชาต',
  'ธนาคารออมสิน',
  'ธนาคาร ธ.ก.ส.',
]

interface AddressValue {
  address: string
  province: string
  district: string
  subdistrict: string
  postalCode: string
}

interface WriterInfoFormValues {
  prefix: string
  firstName: string
  lastName: string
  nationalId: string
  idAddress: AddressValue
  currentAddress: AddressValue
  phone: string
  email: string
  bankName: string
  bankBranch: string
  bankAccount: string
}

const EMPTY_ADDRESS: AddressValue = { address: '', province: '', district: '', subdistrict: '', postalCode: '' }

const DEFAULT_VALUES: WriterInfoFormValues = {
  prefix: '',
  firstName: '',
  lastName: '',
  nationalId: '',
  idAddress: EMPTY_ADDRESS,
  currentAddress: EMPTY_ADDRESS,
  phone: '',
  email: '',
  bankName: '',
  bankBranch: '',
  bankAccount: '',
}

function applicationToValues(app: WriterApplication, email: string): WriterInfoFormValues {
  return {
    prefix: app.user_prefix,
    firstName: app.first_name,
    lastName: app.last_name,
    nationalId: app.national_id ?? '',
    idAddress: {
      address: app.id_address ?? '',
      province: app.id_province ?? '',
      district: app.id_district ?? '',
      subdistrict: app.id_subdistrict ?? '',
      postalCode: app.id_postal_code ?? '',
    },
    currentAddress: {
      address: app.current_address ?? '',
      province: app.current_province ?? '',
      district: app.current_district ?? '',
      subdistrict: app.current_subdistrict ?? '',
      postalCode: app.current_postal_code ?? '',
    },
    phone: app.user_phone,
    email,
    bankName: app.bank_name,
    bankBranch: app.bank_branch ?? '',
    bankAccount: app.bank_number ?? '',
  }
}

function valuesToPayload(v: WriterInfoFormValues) {
  return {
    user_prefix: v.prefix,
    first_name: v.firstName,
    last_name: v.lastName,
    national_id: v.nationalId || undefined,
    id_address: v.idAddress.address || undefined,
    id_province: v.idAddress.province || undefined,
    id_district: v.idAddress.district || undefined,
    id_subdistrict: v.idAddress.subdistrict || undefined,
    id_postal_code: v.idAddress.postalCode || undefined,
    current_address: v.currentAddress.address || undefined,
    current_province: v.currentAddress.province || undefined,
    current_district: v.currentAddress.district || undefined,
    current_subdistrict: v.currentAddress.subdistrict || undefined,
    current_postal_code: v.currentAddress.postalCode || undefined,
    user_phone: v.phone,
    bank_name: v.bankName,
    bank_branch: v.bankBranch || undefined,
    bank_number: v.bankAccount || undefined,
  }
}

const ONBOARDING_TABS = [
  { key: 'terms', label: 'ข้อตกลงการใช้งาน' },
  { key: 'howto', label: 'วิธีสมัครเป็นนักเขียน' },
] as const
type OnboardingTabKey = (typeof ONBOARDING_TABS)[number]['key']

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  )
}

function AddressFields({
  value,
  disabled,
  onChange,
}: {
  value: AddressValue
  disabled: boolean
  onChange: (next: AddressValue) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <Field label="ที่อยู่">
        <input
          value={value.address}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          className={INPUT_CLASS}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="จังหวัด">
          <input
            value={value.province}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, province: e.target.value })}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="อำเภอ/เขต">
          <input
            value={value.district}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, district: e.target.value })}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="ตำบล/แขวง">
          <input
            value={value.subdistrict}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, subdistrict: e.target.value })}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="รหัสไปรษณีย์">
          <input
            value={value.postalCode}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, postalCode: e.target.value })}
            maxLength={5}
            className={INPUT_CLASS}
          />
        </Field>
      </div>
    </div>
  )
}

export default function WriterInfoPage() {
  const user = useUser()
  const uuid = user?.uuid
  const isApproved = (user?.level ?? 0) >= 6

  const { data: application, isLoading } = useMyWriterApplication()
  const onboardingConfirmed = useOnboardingConfirmed(uuid)
  const confirmOnboarding = useWriterOnboardingStore((s) => s.confirmOnboarding)
  const queryClient = useQueryClient()

  // แก้ไขได้เฉพาะตอนกด "แก้ไขข้อมูล" ปลดล็อกเองเท่านั้น (เฉพาะตอน status==='approve') — pending
  // ล็อกเสมอไม่ว่า editing จะเป็นอะไร (กันแก้ทับระหว่างรอตรวจสอบ), rejected ไม่ล็อกอยู่แล้วโดยธรรมชาติ
  const [editing, setEditing] = useState(false)
  const locked =
    application?.status === 'pending' ? true : application?.status === 'approve' ? !editing : false

  // ใบล่าสุดเป็นการ "แก้ไขข้อมูล" (ไม่ใช่ใบสมัครนักเขียนใหม่) ของคนที่เป็นนักเขียนอยู่แล้ว — ใช้แยก
  // ข้อความแจ้งเตือนออกจากสถานะ "เป็นนักเขียนหรือยัง" หลัก (isApproved ด้านล่างชนะเสมอ ไม่ว่า
  // ใบแก้ไขล่าสุดจะสถานะอะไร เพราะ level>=6 คือความจริงที่สุด)
  const latestIsEdit = application?.application_type === 'edit'
  const editPending = isApproved && latestIsEdit && application?.status === 'pending'
  const editRejected = isApproved && latestIsEdit && application?.status === 'rejected'

  const [draft, setDraft] = useState<WriterInfoFormValues>(() => ({
    ...DEFAULT_VALUES,
    email: user?.email ?? '',
  }))

  // เติมฟอร์มจากข้อมูลจริงทันทีที่โหลดเสร็จ (ทั้งกรณีล็อก และกรณี rejected ที่ให้แก้ไขต่อได้)
  useEffect(() => {
    if (application) {
      setDraft(applicationToValues(application, user?.email ?? ''))
    }
  }, [application, user?.email])

  const values = draft

  function update(patch: Partial<WriterInfoFormValues>) {
    if (locked) return
    setDraft((d) => ({ ...d, ...patch }))
  }

  function handleStartEdit() {
    setEditing(true)
  }

  function handleCancelEdit() {
    if (application) setDraft(applicationToValues(application, user?.email ?? ''))
    setEditing(false)
  }

  const [modalTab, setModalTab] = useState<OnboardingTabKey>('terms')
  const [termsChecked, setTermsChecked] = useState(false)
  const showOnboarding = !isLoading && Boolean(uuid) && !application && !onboardingConfirmed

  function handleConfirmOnboarding() {
    if (!uuid || !termsChecked) return
    confirmOnboarding(uuid)
  }

  const submitMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof valuesToPayload>) =>
      api.post('/users/me/writer-application', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['writer-application'] })
      setEditing(false)
      toast.success(
        isApproved ? 'ส่งคำขอแก้ไขข้อมูลสำเร็จ รอทีมงานตรวจสอบ' : 'ส่งข้อมูลนักเขียนสำเร็จ รอทีมงานตรวจสอบ',
      )
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'ส่งข้อมูลไม่สำเร็จ')
    },
  })

  function handleSave() {
    if (locked) return
    submitMutation.mutate(valuesToPayload(draft))
  }

  if (isLoading) {
    return <p className="py-20 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* Onboarding modal — บังคับยอมรับข้อตกลงก่อนกรอกฟอร์มครั้งแรก ปิดเองไม่ได้ (ไม่มีปุ่ม X,
          กด escape/คลิกนอกกรอบไม่ได้) โชว์แค่ครั้งเดียวต่อ user (persist ผ่าน onboardingConfirmed) */}
      <Dialog open={showOnboarding} onOpenChange={() => {}}>
        <DialogContent
          showCloseButton={false}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-[1.5rem] border border-border/80 bg-card p-0 shadow-[0_30px_80px_-38px_rgb(45_29_32_/_0.44)] sm:max-w-xl"
        >
          <DialogHeader className="border-b border-border/70 px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <PenLine className="size-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-[0.14em] text-primary">WRITER ONBOARDING</p>
                <DialogTitle className="mt-0.5 text-lg font-bold tracking-[-0.02em]">ก่อนเริ่มขอสิทธิ์เป็นนักเขียน</DialogTitle>
                <p className="mt-1 text-xs text-muted-foreground">อ่านข้อมูลเบื้องต้นก่อนเริ่มกรอกใบสมัคร</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 px-5 py-5 sm:px-6">
            <div
              role="tablist"
              aria-label="ข้อมูลก่อนสมัครเป็นนักเขียน"
              className="grid grid-cols-2 rounded-xl border border-border bg-muted/65 p-1"
            >
              {ONBOARDING_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={modalTab === t.key}
                  onClick={() => setModalTab(t.key)}
                  className={cn(
                    'cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold transition-all',
                    modalTab === t.key
                      ? 'bg-card text-primary shadow-sm ring-1 ring-border/70'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="min-h-36 max-h-64 overflow-y-auto rounded-xl border border-border/80 bg-background/55 p-4 text-sm leading-6 text-muted-foreground">
              {modalTab === 'terms' ? (
                <p>(เนื้อหาข้อตกลงการใช้งานฉบับเต็มจะเพิ่มเติมภายหลัง)</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p>1. กรอกข้อมูลส่วนบุคคลและบัญชีธนาคารให้ครบถ้วนถูกต้อง</p>
                  <p>2. กดส่งข้อมูล — หลังส่งแล้วจะไม่สามารถแก้ไขข้อมูลได้อีก กรุณาตรวจสอบให้ถูกต้องก่อนส่ง</p>
                  <p>3. รอทีมงานตรวจสอบและอนุมัติ (ดูสถานะได้ที่หน้านี้ตลอดเวลา)</p>
                  <p>4. เมื่อได้รับอนุมัติแล้ว จะเข้าเมนู "นิยาย" เพื่อเริ่มสร้างผลงานได้ทันที</p>
                </div>
              )}
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-primary/10 bg-primary/5 p-3 text-sm text-foreground select-none">
              <Checkbox checked={termsChecked} onCheckedChange={(v) => setTermsChecked(v === true)} className="mt-0.5" />
              <span>
                <span className="block font-medium">ฉันได้อ่านและยอมรับข้อตกลงการใช้งานแล้ว</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">โปรดตรวจสอบข้อมูลก่อนส่งคำขอ เนื่องจากจะไม่สามารถแก้ไขได้ระหว่างรอตรวจสอบ</span>
              </span>
            </label>
          </div>

          <div className="border-t border-border/70 bg-muted/35 px-5 py-4 sm:px-6">
            <Button disabled={!termsChecked} onClick={handleConfirmOnboarding} className="h-10 w-full gap-2 rounded-xl font-semibold">
              <ShieldCheck className="size-4" />
              ยืนยันและเริ่มกรอกข้อมูล
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <h1 className="text-2xl font-bold text-foreground">ข้อมูลนักเขียน</h1>

      {/* สถานะ — level>=6 ชนะทุกกรณี (อนุมัติแล้วจริง) ไม่งั้นดูจาก application.status จริง */}
      {isApproved ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <CircleCheck className="size-5 shrink-0" />
          สถานะการลงทะเบียนนักเขียน: อนุมัติแล้ว
        </div>
      ) : application?.status === 'pending' ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          <Clock3 className="size-5 shrink-0" />
          สถานะการลงทะเบียนนักเขียน: รอการตรวจสอบ
        </div>
      ) : application?.status === 'rejected' ? (
        <div className="flex flex-col gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          <span className="flex items-center gap-2">
            <CircleX className="size-5 shrink-0" />
            สถานะการลงทะเบียนนักเขียน: ไม่ผ่านการอนุมัติ
          </span>
          {application.reject_reason && (
            <span className="pl-7 text-xs font-normal">เหตุผล: {application.reject_reason}</span>
          )}
          <span className="pl-7 text-xs font-normal">แก้ไขข้อมูลด้านล่างแล้วส่งใหม่ได้เลย</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm font-medium text-muted-foreground">
          <Circle className="size-5 shrink-0" />
          สถานะการลงทะเบียนนักเขียน: ยังไม่ได้ส่งคำขอ
        </div>
      )}

      {/* แบนเนอร์ที่ 2 — เฉพาะสถานะ "การแก้ไขข้อมูล" ของนักเขียนที่อนุมัติแล้ว แยกจากแบนเนอร์หลัก
          ด้านบนที่บอกแค่ "เป็นนักเขียนหรือยัง" (isApproved ชนะเสมอ ไม่งั้นจะดูเหมือนเสียสถานะนักเขียน
          ไปทั้งที่ level ยังคง 6 ปกติ แค่ใบแก้ไขล่าสุดยังไม่ผ่าน/รอตรวจสอบ) */}
      {editPending && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          <Clock3 className="size-5 shrink-0" />
          มีการแก้ไขข้อมูลที่รอทีมงานตรวจสอบ — ระหว่างนี้จะไม่สามารถขอถอนเงินได้จนกว่าจะได้รับการยืนยัน
        </div>
      )}

      {editRejected && (
        <div className="flex flex-col gap-1 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          <span className="flex items-center gap-2">
            <CircleX className="size-5 shrink-0" />
            การแก้ไขข้อมูลล่าสุดไม่ผ่านการอนุมัติ
          </span>
          {application?.reject_reason && (
            <span className="pl-7 text-xs font-normal">เหตุผล: {application.reject_reason}</span>
          )}
          <span className="pl-7 text-xs font-normal">แก้ไขข้อมูลด้านล่างแล้วส่งใหม่ได้เลย</span>
        </div>
      )}

      {application?.status === 'pending' && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          กำลังรอทีมงานตรวจสอบ ไม่สามารถแก้ไขข้อมูลซ้ำได้จนกว่าจะทราบผล
        </div>
      )}

      {application?.status === 'approve' && !editing && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Lock className="size-4 shrink-0" />
            ข้อมูลนี้ผ่านการอนุมัติแล้ว ต้องการแก้ไขกดปุ่มด้านขวา (การแก้ไขต้องรอตรวจสอบใหม่ก่อนมีผล)
          </span>
          <Button variant="outline" onClick={handleStartEdit} className="h-8 shrink-0 gap-1.5 rounded-lg text-xs">
            <PenLine className="size-3.5" />
            แก้ไขข้อมูล
          </Button>
        </div>
      )}

      {editing && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
          <PenLine className="size-4 shrink-0" />
          กำลังแก้ไขข้อมูล — กด &quot;บันทึกการแก้ไข&quot; เพื่อส่งให้ทีมงานตรวจสอบ (ระหว่างรอผลจะขอถอนเงินไม่ได้)
        </div>
      )}

      {/* ข้อมูลส่วนบุคคล */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-2 text-base font-semibold text-foreground">
          <User className="size-5 text-primary" />
          ข้อมูลส่วนบุคคล
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr_1fr]">
            <Field label="คำนำหน้า">
              <Select
                value={values.prefix}
                onValueChange={(v) => update({ prefix: v })}
                disabled={locked}
              >
                <SelectTrigger className={`!h-9 w-full ${INPUT_CLASS}`}>
                  <SelectValue placeholder="เลือก" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="นาย">นาย</SelectItem>
                  <SelectItem value="นาง">นาง</SelectItem>
                  <SelectItem value="นางสาว">นางสาว</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="ชื่อ">
              <input
                value={values.firstName}
                disabled={locked}
                onChange={(e) => update({ firstName: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="นามสกุล">
              <input
                value={values.lastName}
                disabled={locked}
                onChange={(e) => update({ lastName: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
          </div>

          <Field label="หมายเลขบัตรประชาชน">
            <input
              value={values.nationalId}
              disabled={locked}
              onChange={(e) => update({ nationalId: e.target.value })}
              maxLength={13}
              className={INPUT_CLASS}
            />
          </Field>

          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">ที่อยู่ตามบัตรประชาชน</p>
            <AddressFields
              value={values.idAddress}
              disabled={locked}
              onChange={(v) => update({ idAddress: v })}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">ที่อยู่ปัจจุบัน</p>
            <AddressFields
              value={values.currentAddress}
              disabled={locked}
              onChange={(v) => update({ currentAddress: v })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="เบอร์โทรศัพท์">
              <input
                value={values.phone}
                disabled={locked}
                onChange={(e) => update({ phone: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="อีเมล">
              <input
                value={values.email}
                disabled={locked}
                onChange={(e) => update({ email: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* ข้อมูลบัญชีธนาคาร */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-2 text-base font-semibold text-foreground">
          <Landmark className="size-5 text-primary" />
          ข้อมูลบัญชีธนาคาร
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="ชื่อธนาคาร">
            <Select
              value={values.bankName}
              onValueChange={(v) => update({ bankName: v })}
              disabled={locked}
            >
              <SelectTrigger className={`!h-9 w-full ${INPUT_CLASS}`}>
                <SelectValue placeholder="เลือกธนาคาร" />
              </SelectTrigger>
              <SelectContent>
                {BANKS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="สาขาบัญชีธนาคาร">
            <input
              value={values.bankBranch}
              disabled={locked}
              onChange={(e) => update({ bankBranch: e.target.value })}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="เลขที่บัญชีธนาคาร">
            <input
              value={values.bankAccount}
              disabled={locked}
              onChange={(e) => update({ bankAccount: e.target.value })}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      </div>

      {!locked && (
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={submitMutation.isPending} className="rounded-lg">
            {submitMutation.isPending
              ? 'กำลังส่ง...'
              : editing
                ? 'บันทึกการแก้ไข'
                : application?.status === 'rejected'
                  ? 'ส่งข้อมูลใหม่อีกครั้ง'
                  : 'บันทึกข้อมูล'}
          </Button>
          {editing && (
            <Button variant="outline" onClick={handleCancelEdit} disabled={submitMutation.isPending} className="rounded-lg">
              ยกเลิก
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
