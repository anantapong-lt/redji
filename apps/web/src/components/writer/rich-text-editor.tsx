'use client'

import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import { Indent } from '@/lib/tiptap-indent'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link as LinkIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function ToolbarButton({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active?: boolean
  onClick: () => void
  label: string
  icon: typeof Bold
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        active && 'bg-primary/10 text-primary',
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}

// Rich text editor สำหรับ "เรื่องย่อ" — เก็บเป็น Tiptap JSON (ไม่ใช่ HTML string ตรงๆ)
// เพื่อเลี่ยงต้องใช้ dangerouslySetInnerHTML ตอน render ฝั่งอ่าน (ความปลอดภัย XSS)
// toolbar ตอนนี้เป็นระดับพื้นฐานตามที่ตกลงกัน — ยังไม่มีสี/highlight/find-replace
export function RichTextEditor({
  content,
  onChange,
}: {
  content?: JSONContent
  onChange?: (json: JSONContent) => void
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // link/underline ปิดในนี้ เพราะ StarterKit v3 มีมาให้ในตัวแล้ว (ปิดกันชื่อซ้ำ)
      // แล้วใช้ instance ที่ import แยกมาข้างล่างแทน เพราะต้อง config เพิ่ม (openOnClick ฯลฯ)
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      TextAlign.configure({ types: ['paragraph'] }),
      Link.configure({ openOnClick: false, autolink: true }),
      Indent,
    ],
    content,
    editorProps: {
      attributes: {
        class: cn(
          'min-h-[220px] px-3 py-2 text-sm outline-none',
          '[&_p]:mb-2 [&_p:last-child]:mb-0',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_a]:text-blue-600 [&_a]:underline',
        ),
      },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
  })

  if (!editor) return null

  function setLink() {
    const previousUrl = editor!.getAttributes('link').href as string | undefined
    const url = window.prompt('ใส่ลิงก์ (URL)', previousUrl ?? '')
    if (url === null) return
    if (url === '') {
      editor!.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-card">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-2 py-1.5">
        <ToolbarButton
          label="ตัวหนา"
          icon={Bold}
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="ตัวเอียง"
          icon={Italic}
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="ขีดเส้นใต้"
          icon={UnderlineIcon}
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          label="ขีดฆ่า"
          icon={Strikethrough}
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          label="ชิดซ้าย"
          icon={AlignLeft}
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        />
        <ToolbarButton
          label="กึ่งกลาง"
          icon={AlignCenter}
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        />
        <ToolbarButton
          label="ชิดขวา"
          icon={AlignRight}
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        />
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          label="รายการแบบจุด"
          icon={List}
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="รายการแบบเลข"
          icon={ListOrdered}
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton label="แทรกลิงก์" icon={LinkIcon} active={editor.isActive('link')} onClick={setLink} />
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
