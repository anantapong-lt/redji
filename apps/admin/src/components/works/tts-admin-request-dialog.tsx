'use client'

import { useEffect, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { api } from '@/lib/api'
import type { AdminEpisodeRow } from '@/types'

export function TtsAdminRequestDialog({
  workUuid,
  episodes,
  onCreated,
}: {
  workUuid: string
  episodes: AdminEpisodeRow[]
  /** เดิมไม่มี — สร้างคำขอสำเร็จแล้วปิด dialog เฉยๆ ไม่มีอะไรรีเฟรชเลย (2026-08-11 user เจอเอง) */
  onCreated?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelected(new Set(episodes.map((episode) => episode.ep_id)))
      setError(null)
    }
  }, [open, episodes])

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit() {
    if (selected.size === 0) {
      setError('เลือกอย่างน้อยหนึ่งตอนก่อนสร้างคำขอ')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.post('/admin/tts/requests', { work_uuid: workUuid, episode_ids: [...selected], tier: 'basic' })
      setOpen(false)
      onCreated?.()
    } catch (err: any) {
      setError(err?.message ?? 'สร้างคำขอ TTS ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="h-10 gap-1.5 rounded-full border-violet-500/60 text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/30">
        <Volume2 className="size-4" /> เพิ่มคำขอ TTS
      </Button>
      <Modal open={open} onClose={() => !saving && setOpen(false)} title="เพิ่มคำขอ TTS จากผู้ดูแล">
        <p className="mb-3 text-sm text-muted-foreground">คำขอนี้จะเข้าสู่รายการรออนุมัติในชื่อผู้ดูแล ก่อนกดเริ่มสร้างเสียง</p>
        <div className="max-h-64 divide-y overflow-y-auto rounded-lg border border-border">
          {episodes.map((episode) => (
            <label key={episode.ep_id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
              <input type="checkbox" checked={selected.has(episode.ep_id)} onChange={() => toggle(episode.ep_id)} className="size-4 accent-primary" />
              <span className="truncate text-sm">ตอนที่ {episode.ep_no} · {episode.ep_name}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">เลือกแล้ว {selected.size} จาก {episodes.length} ตอน</p>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>ยกเลิก</Button>
          <Button type="button" onClick={submit} disabled={saving || selected.size === 0} className="bg-violet-600 text-white hover:bg-violet-700">{saving ? 'กำลังสร้าง...' : 'สร้างคำขอ'}</Button>
        </div>
      </Modal>
    </>
  )
}
