import { defaultKeymap, history, historyKeymap, insertNewline } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { EditorState, Prec } from '@codemirror/state'
import {
  placeholder as cmPlaceholder,
  Decoration,
  type DecorationSet,
  drawSelection,
  EditorView,
  keymap,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { useEffect, useRef } from 'react'

// The notes editor: CodeMirror 6 over markdown, themed only from the kacola tokens (CSS variables, so
// light / dark / high contrast follow the document without rebuilding the editor). Body in Instrument
// Sans, headings in Bricolage at the title scale, quotes in Fraunces italic (the brand's editorial
// moment), code in JetBrains Mono.
//
// It is a plain text editor first: Enter inserts a bare newline (no list continuation, no auto-indent,
// no auto-closed brackets), so what the user types is exactly what is saved — the notes' first rule.
// What it shows is calmer than what it saves: a heading's `##` and a list's `-` are drawn as nothing and
// as a bullet on every line but the one being edited (the text itself is untouched).

const theme = EditorView.theme({
  '&': {
    color: 'var(--k-color-text-primary)',
    backgroundColor: 'transparent',
    fontFamily: 'var(--k-font-family-sans)',
    fontSize: 'var(--k-typography-body-size)',
    height: '100%',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'inherit',
    lineHeight: 'var(--k-typography-body-line-height)',
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '20px 0 48px',
    caretColor: 'var(--k-color-text-primary)',
    maxWidth: '720px',
    margin: '0 auto',
  },
  '.cm-line': { padding: '0 24px' },
  '.cm-cursor, .cm-dropCursor': { borderLeft: '2px solid var(--k-color-text-primary)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    { backgroundColor: 'color-mix(in srgb, var(--k-color-accent-record) 22%, transparent)' },
  '.cm-placeholder': { color: 'var(--k-color-text-secondary)', fontStyle: 'normal' },
  // a bullet is a fixed-width box, so a list line can hang: wrapped lines start under the text, not the dot
  '.cm-bullet': {
    color: 'var(--k-color-text-secondary)',
    display: 'inline-block',
    width: '1.1em',
    textIndent: '0',
  },
  '.cm-line.cm-list': { paddingLeft: 'calc(24px + 1.1em)', textIndent: '-1.1em' },
  // a blank line is paragraph space, not a full empty line: a heading sits close to what follows it
  '.cm-line.cm-blank': { lineHeight: '12px' },
  '.cm-line.cm-heading:not(:first-child)': { paddingTop: '8px' },
})

const heading = (size: string, lh: string, weight: string, tracking: string) => ({
  fontFamily: 'var(--k-font-family-display)',
  fontSize: `var(${size})`,
  lineHeight: `var(${lh})`,
  fontWeight: `var(${weight})`,
  letterSpacing: `var(${tracking})`,
})

const highlight = HighlightStyle.define([
  {
    tag: t.heading1,
    ...heading(
      '--k-typography-title1-size',
      '--k-typography-title1-line-height',
      '--k-typography-title1-weight',
      '--k-typography-title1-tracking',
    ),
  },
  {
    tag: t.heading2,
    ...heading(
      '--k-typography-title2-size',
      '--k-typography-title2-line-height',
      '--k-typography-title2-weight',
      '--k-typography-title2-tracking',
    ),
  },
  {
    tag: [t.heading3, t.heading4, t.heading5, t.heading6],
    fontFamily: 'var(--k-font-family-display)',
    fontSize: 'var(--k-typography-headline-size)',
    fontWeight: '650',
  },
  { tag: t.strong, fontWeight: '650' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--k-color-text-secondary)' },
  { tag: t.quote, fontFamily: 'var(--k-font-family-editorial)', fontStyle: 'italic' },
  { tag: [t.link, t.url], color: 'var(--k-color-accent-record-text)', textDecoration: 'underline' },
  { tag: t.monospace, fontFamily: 'var(--k-font-family-mono)', fontSize: 'var(--k-typography-mono-size)' },
  // list bullets, heading #s, emphasis marks, task boxes: present but quiet
  { tag: [t.processingInstruction, t.meta, t.contentSeparator], color: 'var(--k-color-text-secondary)' },
])

class Bullet extends WidgetType {
  toDOM() {
    const s = document.createElement('span')
    s.className = 'cm-bullet'
    s.textContent = '•'
    return s
  }
  override eq() {
    return true
  }
}

const LIST_LINE = Decoration.line({ class: 'cm-list' })
const BLANK_LINE = Decoration.line({ class: 'cm-blank' })
const HEADING_LINE = Decoration.line({ class: 'cm-heading' })

function quietMarks(view: EditorView): DecorationSet {
  const out: ReturnType<Decoration['range']>[] = []
  const { state } = view
  // the line being edited shows its marks; an editor without focus is being read, not edited
  const editing = new Set(
    view.hasFocus ? state.selection.ranges.map((r) => state.doc.lineAt(r.head).number) : [],
  )
  for (const { from, to } of view.visibleRanges) {
    // line shapes (every line, the edited one too, so nothing jumps as the caret moves)
    for (let pos = from; pos <= to; ) {
      const line = state.doc.lineAt(pos)
      if (!line.text.trim()) out.push(BLANK_LINE.range(line.from))
      pos = line.to + 1
    }
    syntaxTree(state).iterate({
      from,
      to,
      enter: (n) => {
        const line = state.doc.lineAt(n.from)
        if (n.name === 'ListMark' && /^[-*+]$/.test(state.sliceDoc(n.from, n.to)))
          out.push(LIST_LINE.range(line.from))
        if (/^ATXHeading\d$/.test(n.name)) out.push(HEADING_LINE.range(line.from))
        if (editing.has(line.number)) return
        if (n.name === 'HeaderMark' && n.from === line.from) {
          // the marks and the space after them
          const end = Math.min(line.to, n.to + (state.sliceDoc(n.to, n.to + 1) === ' ' ? 1 : 0))
          if (end > n.from) out.push(Decoration.replace({}).range(n.from, end))
        } else if (n.name === 'ListMark' && /^[-*+]$/.test(state.sliceDoc(n.from, n.to))) {
          // the mark and the space after it: the bullet's box is the gap
          const end = Math.min(line.to, n.to + (state.sliceDoc(n.to, n.to + 1) === ' ' ? 1 : 0))
          out.push(Decoration.replace({ widget: new Bullet() }).range(n.from, end))
        }
      },
    })
  }
  return Decoration.set(out, true)
}

const quiet = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = quietMarks(view)
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || u.selectionSet || u.focusChanged)
        this.decorations = quietMarks(u.view)
    }
  },
  { decorations: (v) => v.decorations },
)

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** What a parent may do to a mounted editor: put text at the end (Ask's Pin to notes), focus it. */
export type NotesEditorHandle = { append: (text: string) => void; focus: () => void }

export function NotesEditor({
  initial,
  onChange,
  label,
  placeholder,
  autoFocus,
  handle,
  bottomSpace = 48,
  size = 'body',
  flush = false,
}: {
  initial: string
  onChange: (text: string) => void
  /** Accessible name of the text box. */
  label: string
  placeholder?: string
  autoFocus?: boolean
  handle?: { current: NotesEditorHandle | null }
  /** Room under the last line (px), so something laid over the bottom never hides what is typed. */
  bottomSpace?: number
  /** `large`: the live notepad's calmer, bigger type. */
  size?: 'body' | 'large'
  /** Text flush with the container's edges (in a page column), not a centred, padded sheet. */
  flush?: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const change = useRef(onChange)
  change.current = onChange

  // biome-ignore lint/correctness/useExhaustiveDependencies: the editor is created once per mount; a new head remounts it (key)
  useEffect(() => {
    // CodeMirror styles itself with style-mod, which injects a <style> element into a document — our
    // CSP (style-src 'self', no inline) refuses that. Inside a shadow root it uses a constructable
    // stylesheet (adoptedStyleSheets) instead, which CSP does not govern. Tokens (CSS variables) and the
    // bundled @font-faces inherit into the shadow tree, so the theme still follows the document.
    const el = host.current!
    const shadow = el.shadowRoot ?? el.attachShadow({ mode: 'open' })
    const parent = document.createElement('div')
    parent.style.height = '100%'
    shadow.replaceChildren(parent)
    const view = new EditorView({
      root: shadow,
      parent,
      state: EditorState.create({
        doc: initial,
        extensions: [
          history(),
          // a steady caret under reduced motion (and so in the screenshot baselines)
          drawSelection({ cursorBlinkRate: reducedMotion() ? 0 : 1200 }),
          Prec.high(keymap.of([{ key: 'Enter', run: insertNewline }])),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown({ addKeymap: false }),
          syntaxHighlighting(highlight),
          quiet,
          theme,
          EditorView.theme({
            '.cm-content': {
              paddingBottom: `${bottomSpace}px`,
              ...(size === 'large' ? { fontSize: '17px', lineHeight: '28px' } : {}),
            },
          }),
          ...(flush
            ? [
                Prec.highest(
                  EditorView.theme({
                    '.cm-content': { maxWidth: 'none', margin: '0' },
                    '.cm-line': { paddingLeft: '0', paddingRight: '0' },
                    '.cm-line.cm-list': { paddingLeft: '1.1em' },
                  }),
                ),
              ]
            : []),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            'aria-label': label,
            'aria-multiline': 'true',
            // focusable in the tab order explicitly, so the scroller counts as keyboard-reachable (axe)
            tabindex: '0',
            spellcheck: 'true',
            autocapitalize: 'sentences',
          }),
          ...(placeholder ? [cmPlaceholder(placeholder)] : []),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) change.current(u.state.doc.toString())
          }),
        ],
      }),
    })
    if (autoFocus) view.focus()
    if (handle)
      handle.current = {
        append: (text) => {
          const doc = view.state.doc.toString()
          const sep = doc === '' ? '' : doc.endsWith('\n\n') ? '' : doc.endsWith('\n') ? '\n' : '\n\n'
          const insert = `${sep}${text}`
          view.dispatch({
            changes: { from: doc.length, insert },
            selection: { anchor: doc.length + insert.length },
            scrollIntoView: true,
          })
        },
        focus: () => view.focus(),
      }
    return () => {
      if (handle) handle.current = null
      view.destroy()
      parent.remove()
    }
  }, [])

  return <div ref={host} data-notes-editor="" className="h-full min-h-0 overflow-hidden" />
}
