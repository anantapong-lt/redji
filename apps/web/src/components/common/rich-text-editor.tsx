'use client'

import { useState, type ReactNode } from 'react'
import { Extension, mergeAttributes, Node } from '@tiptap/core'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyleKit } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import { Fragment, Slice, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  Heading2Icon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  Redo2Icon,
  StrikethroughIcon,
  UnderlineIcon,
  Undo2Icon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const lineHeightOptions = [
  { value: 'normal', label: 'ปกติ' },
  { value: '1', label: '1.0' },
  { value: '1.5', label: '1.5' },
  { value: '2', label: '2.0' },
] as const

const inlineStyleProperties = [
  'font-family',
  'font-size',
  'line-height',
  'letter-spacing',
  'color',
  'background-color',
] as const

const blockStyleProperties = [
  ...inlineStyleProperties,
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'text-indent',
] as const

const formattingStyleProperties = [
  ...blockStyleProperties,
  'font-weight',
  'font-style',
  'text-decoration',
  'text-align',
] as const

const allowedPasteElements = new Set([
  'B',
  'BLOCKQUOTE',
  'BR',
  'CODE',
  'DEL',
  'EM',
  'FONT',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HR',
  'I',
  'LI',
  'OL',
  'P',
  'PRE',
  'S',
  'SPAN',
  'STRIKE',
  'STRONG',
  'U',
  'UL',
])

const removedPasteElements = new Set([
  'APPLET',
  'AUDIO',
  'BUTTON',
  'EMBED',
  'FORM',
  'IFRAME',
  'IMG',
  'INPUT',
  'MATH',
  'OBJECT',
  'SCRIPT',
  'SELECT',
  'STYLE',
  'SVG',
  'TEXTAREA',
  'VIDEO',
])

const blockPasteElements = new Set([
  'BLOCKQUOTE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'OL',
  'P',
  'PRE',
  'UL',
])

type AllowedStyleProperty = typeof formattingStyleProperties[number]

function isSafeStyleValue(property: AllowedStyleProperty, value: string): boolean {
  const normalized = value.trim()
  if (!normalized || normalized.length > 200) return false
  if (/url\s*\(|expression\s*\(|(?:var|calc|attr)\s*\(/i.test(normalized)) return false
  if (/[{}<>\\]/.test(normalized)) return false

  if (property === 'text-align') {
    return ['left', 'center', 'right', 'justify', 'start', 'end'].includes(normalized.toLowerCase())
  }

  if (property === 'font-weight') {
    return /^(?:normal|bold|bolder|lighter|[1-9]00)$/i.test(normalized)
  }

  if (property === 'font-style') {
    return /^(?:normal|italic|oblique(?:\s+-?(?:\d+|\d*\.\d+)deg)?)$/i.test(normalized)
  }

  if (property === 'text-decoration') {
    return /^(?:none|underline|line-through|overline)(?:\s+(?:underline|line-through|overline))*$/i.test(normalized)
  }

  if (property === 'font-family') {
    return !/[;:]/.test(normalized) && !/[\u0000-\u001f\u007f]/.test(normalized)
  }

  if (property === 'font-size') {
    if (/^(?:xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger)$/i.test(normalized)) {
      return true
    }
  }

  if (property === 'color' || property === 'background-color') {
    return typeof CSS === 'undefined' || CSS.supports(property, normalized)
  }

  if (property === 'line-height' && normalized.toLowerCase() === 'normal') return true
  if (property === 'letter-spacing' && normalized.toLowerCase() === 'normal') return true

  const allowNegative = ['letter-spacing', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'text-indent']
    .includes(property)
  const numericPattern = allowNegative
    ? /^-?(?:\d+|\d*\.\d+)(?:px|pt|pc|em|rem|%|in|cm|mm|q)?$/i
    : /^(?:\d+|\d*\.\d+)(?:px|pt|pc|em|rem|%|in|cm|mm|q)?$/i

  return numericPattern.test(normalized)
}

function copyAllowedStyles(
  source: CSSStyleDeclaration,
  target: CSSStyleDeclaration,
  overwrite: boolean,
) {
  for (const property of formattingStyleProperties) {
    const value = source.getPropertyValue(property)
    if (!isSafeStyleValue(property, value)) continue
    if (!overwrite && target.getPropertyValue(property)) continue
    target.setProperty(property, value.trim())
  }

  const decorationLine = source.getPropertyValue('text-decoration-line')
  if (
    isSafeStyleValue('text-decoration', decorationLine)
    && (overwrite || !target.getPropertyValue('text-decoration'))
  ) {
    target.setProperty('text-decoration', decorationLine.trim())
  }
}

function resolveClassBasedStyles(parsedDocument: Document) {
  const sourceCss = Array.from(parsedDocument.querySelectorAll('style'))
    .map((styleElement) => styleElement.textContent ?? '')
    .join('\n')
    .replace(/@import[\s\S]*?;/gi, '')
    .replace(/url\s*\([^)]*\)/gi, '')

  if (!sourceCss.trim()) return
  if (typeof CSSStyleSheet === 'undefined' || !('replaceSync' in CSSStyleSheet.prototype)) return

  try {
    const stylesheet = new CSSStyleSheet()
    stylesheet.replaceSync(sourceCss)

    for (const rule of Array.from(stylesheet.cssRules)) {
      if (rule.type !== CSSRule.STYLE_RULE) continue

      const styleRule = rule as CSSStyleRule
      const selectors = styleRule.selectorText
        .split(',')
        .map((selector) => selector.trim())
        .filter((selector) => /^(?:[a-z][\w-]*)?(?:\.[\w-]+)+$/i.test(selector))

      for (const selector of selectors) {
        for (const element of Array.from(parsedDocument.querySelectorAll<HTMLElement>(selector))) {
          copyAllowedStyles(styleRule.style, element.style, false)
        }
      }
    }
  } catch {
    // Invalid or browser-specific Office CSS should not block the paste action.
  }
}

function replaceElementTag(element: HTMLElement, tagName: 'p' | 'span'): HTMLElement {
  const replacement = element.ownerDocument.createElement(tagName)
  for (const attribute of Array.from(element.attributes)) {
    replacement.setAttribute(attribute.name, attribute.value)
  }
  replacement.append(...Array.from(element.childNodes))
  element.replaceWith(replacement)
  return replacement
}

function sanitizePastedElement(element: HTMLElement) {
  if (removedPasteElements.has(element.tagName)) {
    element.remove()
    return
  }

  let normalizedElement = element
  if (element.tagName === 'FONT') {
    const face = element.getAttribute('face')
    const color = element.getAttribute('color')
    if (face && isSafeStyleValue('font-family', face)) element.style.fontFamily = face
    if (color && isSafeStyleValue('color', color)) element.style.color = color
    normalizedElement = replaceElementTag(element, 'span')
  } else if (element.tagName === 'DIV') {
    const containsBlock = Array.from(element.children)
      .some((child) => blockPasteElements.has(child.tagName) || ['OL', 'UL', 'PRE'].includes(child.tagName))
    if (!containsBlock) normalizedElement = replaceElementTag(element, 'p')
  }

  if (!allowedPasteElements.has(normalizedElement.tagName)) {
    normalizedElement.replaceWith(...Array.from(normalizedElement.childNodes))
    return
  }

  const originalStyle = normalizedElement.style
  const safeStyle = normalizedElement.ownerDocument.createElement('span').style
  copyAllowedStyles(originalStyle, safeStyle, true)

  const direction = normalizedElement.getAttribute('dir')?.toLowerCase()
  const listStart = normalizedElement.tagName === 'OL'
    ? normalizedElement.getAttribute('start')
    : null

  for (const attribute of Array.from(normalizedElement.attributes)) {
    normalizedElement.removeAttribute(attribute.name)
  }

  if (safeStyle.cssText) normalizedElement.setAttribute('style', safeStyle.cssText)
  if (direction === 'ltr' || direction === 'rtl' || direction === 'auto') {
    normalizedElement.setAttribute('dir', direction)
  }
  if (listStart && /^\d+$/.test(listStart)) normalizedElement.setAttribute('start', listStart)

  if (!blockPasteElements.has(normalizedElement.tagName) && normalizedElement.tagName !== 'SPAN') {
    const inlineStyle = normalizedElement.ownerDocument.createElement('span').style
    for (const property of inlineStyleProperties) {
      const value = safeStyle.getPropertyValue(property)
      if (value) inlineStyle.setProperty(property, value)
      normalizedElement.style.removeProperty(property)
    }

    if (inlineStyle.cssText && normalizedElement.childNodes.length > 0) {
      const styleWrapper = normalizedElement.ownerDocument.createElement('span')
      styleWrapper.setAttribute('style', inlineStyle.cssText)
      styleWrapper.append(...Array.from(normalizedElement.childNodes))
      normalizedElement.append(styleWrapper)
    }

    if (!normalizedElement.style.cssText) normalizedElement.removeAttribute('style')
  }
}

function getParagraphStyleValue(
  paragraph: HTMLParagraphElement,
  property: typeof blockStyleProperties[number],
): string {
  const paragraphValue = paragraph.style.getPropertyValue(property)
  if (paragraphValue) return paragraphValue

  for (const styledChild of Array.from(paragraph.querySelectorAll<HTMLElement>('[style]'))) {
    const childValue = styledChild.style.getPropertyValue(property)
    if (childValue) return childValue
  }

  return ''
}

function inheritBlankParagraphStyles(parsedDocument: Document) {
  const paragraphs = Array.from(parsedDocument.body.querySelectorAll<HTMLParagraphElement>('p'))

  for (const [index, paragraph] of paragraphs.entries()) {
    if (paragraph.textContent?.trim()) continue

    const previousParagraph = paragraphs
      .slice(0, index)
      .reverse()
      .find((candidate) => candidate.textContent?.trim())
    const nextParagraph = paragraphs
      .slice(index + 1)
      .find((candidate) => candidate.textContent?.trim())

    for (const property of blockStyleProperties) {
      if (paragraph.style.getPropertyValue(property)) continue

      const contextualValue = (
        previousParagraph && getParagraphStyleValue(previousParagraph, property)
      ) || (
        nextParagraph && getParagraphStyleValue(nextParagraph, property)
      ) || ''

      if (isSafeStyleValue(property, contextualValue)) {
        paragraph.style.setProperty(property, contextualValue.trim())
      }
    }
  }
}

function normalizePastedHtml(html: string): string {
  const parsedDocument = new DOMParser().parseFromString(html, 'text/html')
  resolveClassBasedStyles(parsedDocument)

  for (const element of Array.from(parsedDocument.body.querySelectorAll<HTMLElement>('*'))) {
    sanitizePastedElement(element)
  }
  inheritBlankParagraphStyles(parsedDocument)

  const commentWalker = parsedDocument.createTreeWalker(parsedDocument.body, NodeFilter.SHOW_COMMENT)
  const comments: Comment[] = []
  while (commentWalker.nextNode()) comments.push(commentWalker.currentNode as Comment)
  for (const comment of comments) comment.remove()

  return parsedDocument.body.innerHTML
}

function getNodeStyles(node: ProseMirrorNode) {
  const block = document.createElement('span').style
  const inline = document.createElement('span').style
  let capturedInlineStyle = false

  if (typeof node.attrs.blockStyle === 'string') {
    block.cssText = node.attrs.blockStyle
  }

  node.descendants((child) => {
    if (capturedInlineStyle) return false

    const textStyle = child.marks.find((mark) => mark.type.name === 'textStyle')
    if (!textStyle) return true

    const attributeProperties = [
      ['fontFamily', 'font-family'],
      ['fontSize', 'font-size'],
      ['lineHeight', 'line-height'],
      ['letterSpacing', 'letter-spacing'],
      ['color', 'color'],
      ['backgroundColor', 'background-color'],
    ] as const

    for (const [attribute, property] of attributeProperties) {
      const value = textStyle.attrs[attribute]
      if (typeof value === 'string' && isSafeStyleValue(property, value)) {
        inline.setProperty(property, value)
      }
    }

    capturedInlineStyle = true
    return false
  })

  return { block, inline }
}

function normalizePastedSlice(slice: Slice): Slice {
  const nodes: ProseMirrorNode[] = []
  slice.content.forEach((node) => nodes.push(node))

  const normalizedNodes = nodes.flatMap((node, index) => {
    if (node.type.name !== 'paragraph' || node.textContent.trim()) return [node]

    const previousNode = nodes
      .slice(0, index)
      .reverse()
      .find((candidate) => candidate.textContent.trim())
    const nextNode = nodes
      .slice(index + 1)
      .find((candidate) => candidate.textContent.trim())
    const previousStyles = previousNode ? getNodeStyles(previousNode) : null
    const nextStyles = nextNode ? getNodeStyles(nextNode) : null
    const paragraphStyle = document.createElement('span').style

    for (const property of blockStyleProperties) {
      const value = (
        previousStyles?.block.getPropertyValue(property)
        || nextStyles?.block.getPropertyValue(property)
        || previousStyles?.inline.getPropertyValue(property)
        || nextStyles?.inline.getPropertyValue(property)
        || ''
      )

      if (isSafeStyleValue(property, value)) {
        paragraphStyle.setProperty(property, value.trim())
      }
    }

    let explicitRowCount = 0
    node.content.forEach((child) => {
      if (child.type.name === 'hardBreak') explicitRowCount += 1
    })

    const rowCount = Math.max(1, explicitRowCount)
    const attributes = {
      ...node.attrs,
      blockStyle: paragraphStyle.cssText || node.attrs.blockStyle,
      direction: node.attrs.direction
        || previousNode?.attrs.direction
        || nextNode?.attrs.direction
        || null,
    }

    return Array.from(
      { length: rowCount },
      () => node.type.create(attributes, Fragment.empty, node.marks),
    )
  })

  return new Slice(Fragment.fromArray(normalizedNodes), slice.openStart, slice.openEnd)
}

declare module '@tiptap/extension-text-style' {
  interface TextStyleAttributes {
    letterSpacing?: string | null
  }
}

const LetterSpacing = Extension.create({
  name: 'letterSpacing',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          letterSpacing: {
            default: null,
            parseHTML: (element) => element.style.letterSpacing || null,
            renderHTML: (attributes) => (
              attributes.letterSpacing
                ? { style: `letter-spacing: ${attributes.letterSpacing}` }
                : {}
            ),
          },
        },
      },
    ]
  },
})

function getBlockStyle(element: HTMLElement): string | null {
  const declarations = element.ownerDocument.createElement('span').style
  for (const property of blockStyleProperties) {
    const value = element.style.getPropertyValue(property)
    if (isSafeStyleValue(property, value)) declarations.setProperty(property, value.trim())
  }
  return declarations.cssText || null
}

const BlockFormatting = Extension.create({
  name: 'blockFormatting',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'blockquote', 'listItem', 'bulletList', 'orderedList', 'codeBlock'],
        attributes: {
          blockStyle: {
            default: null,
            parseHTML: (element) => getBlockStyle(element),
            renderHTML: (attributes) => attributes.blockStyle
              ? { style: attributes.blockStyle }
              : {},
          },
          direction: {
            default: null,
            parseHTML: (element) => element.getAttribute('dir'),
            renderHTML: (attributes) => attributes.direction
              ? { dir: attributes.direction }
              : {},
          },
        },
      },
    ]
  },
})

const SpanParagraph = Node.create({
  name: 'paragraph',
  priority: 1000,
  group: 'block',
  content: 'inline*',
  parseHTML() {
    return [
      { tag: 'p' },
      { tag: 'span[data-type="paragraph"]' },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'paragraph',
        style: 'display: block',
      }),
      0,
    ]
  },
  addCommands() {
    return {
      setParagraph: () => ({ commands }) => commands.setNode(this.name),
    }
  },
  addKeyboardShortcuts() {
    return {
      'Mod-Alt-0': () => this.editor.commands.setParagraph(),
    }
  },
})

export interface RichTextEditorProps {
  id?: string
  initialContent?: string
  name?: string
  onChange?: (html: string) => void
}

interface EditorButtonProps {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

function EditorButton({
  active = false,
  children,
  disabled = false,
  label,
  onClick,
}: EditorButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {children}
    </Button>
  )
}

export function RichTextEditor({
  id = 'rich-text-editor',
  initialContent = '',
  name = 'content',
  onChange,
}: RichTextEditorProps) {
  const [html, setHtml] = useState(initialContent)
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ paragraph: false, underline: false }),
      SpanParagraph,
      TextStyleKit,
      LetterSpacing,
      BlockFormatting,
      TextAlign.configure({ types: ['heading', 'paragraph', 'blockquote', 'listItem'] }),
      Underline,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        id,
        class: 'min-h-96 whitespace-pre-wrap px-4 py-3 text-sm leading-7 outline-none [tab-size:4]',
      },
      transformPastedHTML: normalizePastedHtml,
      transformPasted: normalizePastedSlice,
    },
    onUpdate: ({ editor: currentEditor }) => {
      const nextHtml = currentEditor.getHTML()
      setHtml(nextHtml)
      onChange?.(nextHtml)
    },
  })

  return (
    <div className="overflow-hidden rounded-xl border border-input bg-transparent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-2">
        <EditorButton
          label="หัวข้อ"
          active={editor?.isActive('heading', { level: 2 })}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2Icon />
        </EditorButton>
        <EditorButton
          label="ตัวหนา"
          active={editor?.isActive('bold')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <BoldIcon />
        </EditorButton>
        <EditorButton
          label="ตัวเอียง"
          active={editor?.isActive('italic')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon />
        </EditorButton>
        <EditorButton
          label="ขีดเส้นใต้"
          active={editor?.isActive('underline')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon />
        </EditorButton>
        <EditorButton
          label="ขีดทับ"
          active={editor?.isActive('strike')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <StrikethroughIcon />
        </EditorButton>
        <span className="mx-1 h-6 w-px bg-border" />
        <EditorButton
          label="รายการหัวข้อย่อย"
          active={editor?.isActive('bulletList')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <ListIcon />
        </EditorButton>
        <EditorButton
          label="รายการแบบลำดับเลข"
          active={editor?.isActive('orderedList')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrderedIcon />
        </EditorButton>
        <EditorButton
          label="ข้อความอ้างอิง"
          active={editor?.isActive('blockquote')}
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <QuoteIcon />
        </EditorButton>
        <span className="mx-1 h-6 w-px bg-border" />
        <EditorButton
          label="จัดชิดซ้าย"
          active={editor?.isActive({ textAlign: 'left' })}
          disabled={!editor}
          onClick={() => editor?.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeftIcon />
        </EditorButton>
        <EditorButton
          label="จัดกึ่งกลาง"
          active={editor?.isActive({ textAlign: 'center' })}
          disabled={!editor}
          onClick={() => editor?.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenterIcon />
        </EditorButton>
        <EditorButton
          label="จัดชิดขวา"
          active={editor?.isActive({ textAlign: 'right' })}
          disabled={!editor}
          onClick={() => editor?.chain().focus().setTextAlign('right').run()}
        >
          <AlignRightIcon />
        </EditorButton>
        <span className="mx-1 h-6 w-px bg-border" />
        <Select
          value={String(
            editor?.getAttributes('textStyle').lineHeight
              ?? 'normal',
          )}
          onValueChange={(value) => {
            if (!editor) return

            if (value === 'normal') {
              editor.chain().focus().unsetLineHeight().run()
              return
            }

            editor.chain().focus().setLineHeight(value).run()
          }}
          disabled={!editor}
        >
          <SelectTrigger
            className="h-8! w-28 rounded-lg px-2"
            aria-label="ระยะห่างบรรทัด"
            title="ระยะห่างบรรทัด"
          >
            <span className="text-xs text-muted-foreground">บรรทัด</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {lineHeightOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="mx-1 h-6 w-px bg-border" />
        <EditorButton
          label="ย้อนกลับ"
          disabled={!editor?.can().chain().focus().undo().run()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2Icon />
        </EditorButton>
        <EditorButton
          label="ทำซ้ำ"
          disabled={!editor?.can().chain().focus().redo().run()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2Icon />
        </EditorButton>
      </div>

      <EditorContent
        editor={editor}
        className="[&_.tiptap_blockquote]:border-l-4 [&_.tiptap_blockquote]:border-border [&_.tiptap_blockquote]:pl-4 [&_.tiptap_h2]:my-3 [&_.tiptap_h2]:text-xl [&_.tiptap_h2]:font-bold [&_.tiptap_ol]:my-2 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-6 [&_.tiptap_p]:my-2 [&_.tiptap_ul]:my-2 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-6"
      />
      <input type="hidden" name={name} value={html} />
    </div>
  )
}
