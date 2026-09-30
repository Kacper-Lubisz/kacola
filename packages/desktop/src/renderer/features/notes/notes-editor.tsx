import { defaultKeymap, history, historyKeymap, insertNewline } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState, Prec } from '@codemirror/state'
import { placeholder as cmPlaceholder, drawSelection, EditorView, keymap } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { useEffect, useRef } from 'react'

// The notes editor: CodeMirror 6 over markdown, themed only from the kacola tokens (CSS variables, so
// light / dark / high contrast follow the document without rebuilding the editor). Body in Instrument
// Sans, headings in Bricolage at the title scale, quotes in Fraunces italic (the brand's editorial
// moment), code in JetBrains Mono.
//
// It is a plain text editor first: Enter inserts a bare newline (no list continuation, no auto-indent,
// no auto-closed brackets), so what the user types is exactly what is saved — the notes' first rule.

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

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function NotesEditor({
  initial,
  onChange,
  label,
  placeholder,
  autoFocus,
}: {
  initial: string
  onChange: (text: string) => void
  /** Accessible name of the text box. */
  label: string
  placeholder?: string
  autoFocus?: boolean
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
          theme,
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
    return () => {
      view.destroy()
      parent.remove()
    }
  }, [])

  return <div ref={host} data-notes-editor="" className="h-full min-h-0 overflow-hidden" />
}
