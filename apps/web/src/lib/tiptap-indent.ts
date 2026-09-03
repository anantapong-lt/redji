import { Extension } from '@tiptap/core'

// Extension เสริม — Tiptap ไม่มี "ย่อหน้าแบบหน้ากระดาษนิยาย" (text-indent บรรทัดแรก) มาให้เอง
// กด Tab = ย่อหน้าเพิ่ม, Shift+Tab = ย่อหน้าลด — เก็บเป็น attribute "indent" บน paragraph
// แล้ว render เป็น CSS text-indent (มี unit เป็น em คูณตามระดับ)

const INDENT_SIZE_EM = 2
const MAX_INDENT = 8

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType
      outdent: () => ReturnType
    }
  }
}

export const Indent = Extension.create({
  name: 'indent',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          indent: {
            default: 0,
            renderHTML: (attributes) => {
              const level = attributes.indent as number
              if (!level) return {}
              return { style: `text-indent: ${level * INDENT_SIZE_EM}em` }
            },
            parseHTML: (element) => {
              const value = parseFloat(element.style.textIndent || '0')
              return value ? Math.round(value / INDENT_SIZE_EM) : 0
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ tr, state, dispatch }) => {
          const { from, to } = state.selection
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === 'paragraph') {
              const current = (node.attrs.indent as number) || 0
              if (current < MAX_INDENT) {
                tr.setNodeAttribute(pos, 'indent', current + 1)
              }
            }
          })
          if (dispatch) dispatch(tr)
          return true
        },
      outdent:
        () =>
        ({ tr, state, dispatch }) => {
          const { from, to } = state.selection
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === 'paragraph') {
              const current = (node.attrs.indent as number) || 0
              if (current > 0) {
                tr.setNodeAttribute(pos, 'indent', current - 1)
              }
            }
          })
          if (dispatch) dispatch(tr)
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      'Shift-Tab': () => this.editor.commands.outdent(),
    }
  },
})
