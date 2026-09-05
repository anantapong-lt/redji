'use client'

import { useCallback, useEffect } from 'react'

const COPIED_NOVEL_TEXT = '🦖 เฮ้ย! จับได้แล้วว่ากำลังคัดลอกนิยายอยู่ 😆'

export function useReaderContentProtection({ replaceNovelCopy = false } = {}) {
  const isProduction = process.env.NODE_ENV === 'production'

  useEffect(() => {
    if (!isProduction) return

    const preventDevToolsShortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const isDevToolsShortcut = event.key === 'F12'
        || (event.ctrlKey && event.shiftKey && ['c', 'i', 'j'].includes(key))
        || (event.ctrlKey && key === 'u')

      if (!isDevToolsShortcut) return

      event.preventDefault()
      event.stopPropagation()
    }

    window.addEventListener('keydown', preventDevToolsShortcut, true)
    return () => window.removeEventListener('keydown', preventDevToolsShortcut, true)
  }, [isProduction])

  useEffect(() => {
    if (!isProduction || !replaceNovelCopy) return

    const isWithinNovelReader = (node: Node | null) => {
      const element = node?.nodeType === Node.ELEMENT_NODE
        ? node as Element
        : node?.parentElement
      return element?.closest('[data-reader-type="novel"]') != null
    }
    const replaceCopy = (event: ClipboardEvent) => {
      const selection = window.getSelection()
      if (!selection || (!isWithinNovelReader(selection.anchorNode) && !isWithinNovelReader(selection.focusNode))) {
        return
      }

      event.preventDefault()
      event.clipboardData?.setData('text/plain', COPIED_NOVEL_TEXT)
    }

    document.addEventListener('copy', replaceCopy, true)
    return () => document.removeEventListener('copy', replaceCopy, true)
  }, [isProduction, replaceNovelCopy])

  const preventInteraction = useCallback((event: { preventDefault: () => void }) => {
    if (isProduction) event.preventDefault()
  }, [isProduction])

  return {
    isProduction,
    preventInteraction,
  }
}
