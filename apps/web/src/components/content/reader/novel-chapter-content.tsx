'use client'

import { useEffect, useState } from 'react'
import type { ReadingSettings } from '@/lib/reading-settings'
import { READING_FONTS, READING_THEMES } from '@/lib/reading-settings'
import { ReaderContentSkeleton } from './reader-content-skeleton'
import { useReaderContentProtection } from './use-reader-content-protection'

const BLOCKED_ELEMENTS = 'script,style,iframe,object,embed,form,input,button,textarea,select,meta,link,base,svg,math,img,audio,video,source,canvas'
const SAFE_ATTRIBUTES = new Set(['data-type', 'dir', 'start', 'style'])
const SAFE_STYLE_PROPERTIES = new Set([
  'display',
  'font-style',
  'font-weight',
  'letter-spacing',
  'line-height',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'min-height',
  'text-align',
  'text-decoration',
  'text-decoration-line',
  'text-indent',
])

function isSafeStyleValue(value: string) {
  return value.length <= 200
    && !/(?:@import|behavior|expression|javascript|[-]moz-binding|url)\s*\(/i.test(value)
    && !/[<>\u0000]/.test(value)
}

function sanitizeChapterHtml(html: string) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  document.querySelectorAll('a').forEach((element) => element.replaceWith(...element.childNodes))
  document.querySelectorAll(BLOCKED_ELEMENTS).forEach((element) => element.remove())

  document.body.querySelectorAll('*').forEach((element) => {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase()

      if (!SAFE_ATTRIBUTES.has(name)) {
        element.removeAttribute(attribute.name)
        continue
      }

    }

    const style = (element as HTMLElement).style
    for (const property of [...style]) {
      if (!SAFE_STYLE_PROPERTIES.has(property) || !isSafeStyleValue(style.getPropertyValue(property).trim())) {
        style.removeProperty(property)
      }
    }

    if (element.matches('span[data-type="paragraph"]')) {
      style.display = 'block'
      if (!style.minHeight) style.minHeight = '1lh'
    }
  })

  const paragraphSelector = 'p, span[data-type="paragraph"]'
  for (const paragraph of Array.from(document.body.querySelectorAll<HTMLElement>(paragraphSelector))) {
    const previous = paragraph.previousElementSibling
    paragraph.style.removeProperty('text-indent')
    if (
      previous?.matches(paragraphSelector)
      && !previous.textContent?.trim()
      && paragraph.style.textAlign !== 'center'
    ) {
      paragraph.style.textIndent = '2em'
    }
  }

  return document.body.innerHTML
}

export function NovelChapterContent({
  content,
  settings,
}: {
  content: string
  settings: ReadingSettings
}) {
  const { isProduction, preventInteraction } = useReaderContentProtection({ replaceNovelCopy: true })
  const [sanitizedContent, setSanitizedContent] = useState<{
    source: string
    html: string
  } | null>(null)
  const theme = READING_THEMES[settings.theme]
  const safeContent = sanitizedContent?.source === content
    ? sanitizedContent.html
    : null

  useEffect(() => {
    setSanitizedContent({
      source: content,
      html: sanitizeChapterHtml(content),
    })
  }, [content])

  return (
    <article
      className="px-4 py-8 transition-colors sm:px-10 sm:py-12 lg:px-16"
      style={{ backgroundColor: theme.background, color: theme.text }}
    >
      {safeContent === null ? (
        <ReaderContentSkeleton />
      ) : (
        <div
          className="relative"
          onContextMenu={preventInteraction}
          onDragStart={preventInteraction}
        >
          <div
            className="mx-auto max-w-3xl select-none break-words [&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/35 [&_blockquote]:pl-4 [&_h1]:my-6 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:my-5 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:my-4 [&_h3]:text-xl [&_h3]:font-bold [&_hr]:my-8 [&_li]:my-1 [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-7 [&_p]:min-h-[1lh] [&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-muted [&_pre]:p-4 [&_ul]:my-5 [&_ul]:list-disc [&_ul]:pl-7"
            style={{
              fontFamily: READING_FONTS[settings.fontFamily].family,
              fontSize: settings.fontSize,
              lineHeight: 2,
            }}
            dangerouslySetInnerHTML={{ __html: safeContent }}
          />
          {isProduction ? (
            <div
              aria-hidden
              className="absolute inset-0 z-10 cursor-text"
              onContextMenu={preventInteraction}
              onDragStart={preventInteraction}
            />
          ) : null}
        </div>
      )}
    </article>
  )
}
