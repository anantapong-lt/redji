'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import { Indent } from '@/lib/tiptap-indent'
import { notoSerifThai } from '@/lib/fonts'
import { cn } from '@/lib/utils'

const COLLAPSED_HEIGHT = 600

// แสดง "เรื่องย่อ" (Tiptap JSON) แบบอ่านอย่างเดียว — ใช้ editor จริงแต่ editable: false
// แทน dangerouslySetInnerHTML เพื่อความปลอดภัย (เหมือนฝั่งเขียน)
export function SynopsisReader({ content }: { content: JSONContent | null }) {
  const [expanded, setExpanded] = useState(false)
  const [needsExpand, setNeedsExpand] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      TextAlign.configure({ types: ['paragraph'] }),
      Link.configure({ openOnClick: false }),
      Indent,
    ],
    content: content ?? undefined,
    editorProps: {
      attributes: {
        class: cn(
          'text-[24px] leading-[1.9] text-foreground outline-none',
          // ย่อหน้าแรกบรรทัดแรกอัตโนมัติทุกย่อหน้า แบบหน้าหนังสือ — ไม่ต้องรอ writer กด Tab เอง
          '[&_p]:mb-5 [&_p:last-child]:mb-0 [&_p]:indent-[2em]',
          '[&_ul]:list-disc [&_ul]:pl-8 [&_ol]:list-decimal [&_ol]:pl-8',
          '[&_a]:text-blue-600 [&_a]:underline',
        ),
      },
    },
  })

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    setNeedsExpand(el.scrollHeight > COLLAPSED_HEIGHT + 1)
  }, [content])

  if (!content) {
    return <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีเรื่องย่อ</p>
  }

  const collapsed = needsExpand && !expanded

  return (
    <div className={cn('relative', notoSerifThai.className)}>
      <div
        ref={wrapperRef}
        className="overflow-hidden"
        style={collapsed ? { maxHeight: COLLAPSED_HEIGHT } : undefined}
      >
        <EditorContent editor={editor} />
        {collapsed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>

      {collapsed && (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="cursor-pointer rounded-[10px] border border-border px-4 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            อ่านเพิ่มเติม
          </button>
        </div>
      )}
    </div>
  )
}
