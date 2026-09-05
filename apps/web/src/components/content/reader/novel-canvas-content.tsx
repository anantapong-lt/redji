'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { ReadingSettings } from '@/lib/reading-settings'

interface CanvasBlock {
  id: string
  text: string
  align: CanvasTextAlign
  fontSize: number
  fontWeight: 'normal' | 'bold'
  indent: boolean
  spacing: string
}

const BLOCK_SELECTOR = 'h1,h2,h3,p,li,blockquote,pre,span[data-type="paragraph"]'

function canvasBlocksFromHtml(html: string, settings: ReadingSettings): CanvasBlock[] {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const elements = Array.from(document.body.querySelectorAll<HTMLElement>(BLOCK_SELECTOR))
    .filter((element) => !element.parentElement?.closest(BLOCK_SELECTOR))
  const blocks = elements.map((element, index) => {
    const tagName = element.tagName.toLowerCase()
    const isHeading = tagName === 'h1' || tagName === 'h2' || tagName === 'h3'
    const sizeMultiplier = tagName === 'h1' ? 1.65 : tagName === 'h2' ? 1.35 : tagName === 'h3' ? 1.15 : 1
    const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? ''

    return {
      id: `${tagName}-${index}`,
      text: tagName === 'li' ? `• ${text}` : text,
      align: element.style.textAlign === 'center' || element.style.textAlign === 'right'
        ? element.style.textAlign
        : 'left',
      fontSize: Math.round(settings.fontSize * sizeMultiplier),
      fontWeight: isHeading ? 'bold' : 'normal',
      indent: !isHeading && element.style.textIndent === '2em',
      spacing: isHeading ? 'mb-6' : 'mb-5',
    } satisfies CanvasBlock
  })

  if (blocks.length) return blocks

  const text = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  return text
    ? [{
      id: 'content',
      text,
      align: 'left',
      fontSize: settings.fontSize,
      fontWeight: 'normal',
      indent: false,
      spacing: 'mb-5',
    }]
    : []
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = []
  let line = ''

  for (const character of text) {
    const nextLine = line + character
    if (line && context.measureText(nextLine).width > maxWidth) {
      lines.push(line.trimEnd())
      line = character.trimStart()
      continue
    }
    line = nextLine
  }

  if (line) lines.push(line.trimEnd())
  return lines.length ? lines : ['']
}

function CanvasTextBlock({
  block,
  settings,
  color,
}: {
  block: CanvasBlock
  settings: ReadingSettings
  color: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    if (!canvas || !container) return

    const draw = () => {
      const width = Math.floor(container.clientWidth)
      if (!width) return

      const devicePixelRatio = window.devicePixelRatio || 1
      const fontFamily = settings.fontFamily === 'serif'
        ? 'Georgia, serif'
        : 'Arial, sans-serif'
      const lineHeight = Math.round(block.fontSize * 2)
      const indent = block.indent && block.align === 'left' ? block.fontSize * 2 : 0
      const temporaryContext = canvas.getContext('2d')
      if (!temporaryContext) return

      temporaryContext.font = `${block.fontWeight} ${block.fontSize}px ${fontFamily}`
      const lines = wrapText(temporaryContext, block.text, width - indent)
      const height = Math.max(lineHeight, lines.length * lineHeight)

      canvas.width = Math.ceil(width * devicePixelRatio)
      canvas.height = Math.ceil(height * devicePixelRatio)
      canvas.style.height = `${height}px`

      const context = canvas.getContext('2d')
      if (!context) return

      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      context.font = `${block.fontWeight} ${block.fontSize}px ${fontFamily}`
      context.fillStyle = getComputedStyle(canvas).color
      context.textBaseline = 'top'
      context.textAlign = block.align

      lines.forEach((line, index) => {
        const x = block.align === 'center'
          ? width / 2
          : block.align === 'right'
            ? width
            : (index === 0 ? indent : 0)
        context.fillText(line, x, index * lineHeight)
      })
    }

    const observer = new ResizeObserver(draw)
    observer.observe(container)
    draw()
    return () => observer.disconnect()
  }, [block, color, settings.fontFamily])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`block w-full select-none ${block.spacing}`}
    />
  )
}

export function NovelCanvasContent({
  html,
  settings,
  color,
}: {
  html: string
  settings: ReadingSettings
  color: string
}) {
  const blocks = useMemo(() => canvasBlocksFromHtml(html, settings), [html, settings])

  return (
    <div className="mx-auto max-w-3xl" style={{ color }} aria-label="เนื้อหานิยาย">
      {blocks.map((block) => (
        <CanvasTextBlock key={block.id} block={block} settings={settings} color={color} />
      ))}
    </div>
  )
}
