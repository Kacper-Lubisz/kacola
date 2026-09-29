import * as Adw from '@gtkx/gi/adw'
import * as Gtk from '@gtkx/gi/gtk'
import * as GtkSource from '@gtkx/gi/gtksource'
import { AdwClampScrollable } from '@gtkx/jsx/adw'
import { GtkScrolledWindow } from '@gtkx/jsx/gtk'
import { GtkSourceBuffer, GtkSourceView } from '@gtkx/jsx/gtksource'
import { useProperty } from '@gtkx/react'
import { useMemo } from 'react'
import { _ } from '../i18n/index.ts'

// N-1 — the markdown notes editor: a GtkSourceView 5 with markdown highlighting and an Adwaita style
// scheme that follows light/dark. GtkSource-5 bindings come from a vendored GIR (packages/ui/gir, see
// docs/gtkx.md §3): Fedora ships the typelib with the library but the GIR only in -devel.
//
// The editor is uncontrolled: it is mounted with the head's text and reports every change. When the
// head changes underneath it (a merge, a restore), the parent remounts it with a new key — setting a
// buffer's text on every keystroke would fight the cursor and the undo stack.

let initialised = false
function init() {
  if (initialised) return
  initialised = true
  GtkSource.init()
}

const text = (b: Gtk.TextBuffer): string => {
  const [start, end] = b.getBounds()
  return b.getText(start, end, true)
}

export function NotesEditor({
  initial,
  onChange,
  editable = true,
}: {
  initial: string
  onChange: (markdown: string) => void
  editable?: boolean
}) {
  init()
  const language = useMemo(() => GtkSource.LanguageManager.getDefault().getLanguage('markdown'), [])
  const dark = useProperty(Adw.StyleManager.getDefault(), 'dark')
  const scheme = useMemo(
    () => GtkSource.StyleSchemeManager.getDefault().getScheme(dark ? 'Adwaita-dark' : 'Adwaita'),
    [dark],
  )
  return (
    <GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
      {/* the same reading width as the toolbar above and the transcript */}
      <AdwClampScrollable maximumSize={760} tighteningThreshold={560}>
        <GtkSourceView
          wrapMode={Gtk.WrapMode.WORD_CHAR}
          editable={editable}
          topMargin={12}
          bottomMargin={24}
          leftMargin={12}
          rightMargin={18}
          autoIndent
          smartBackspace
          accessibleLabel={_('Notes')}
          accessibleDescription={_('Your notes for this meeting, in Markdown. Saved as you type.')}
          cssClasses={['notes-editor']}
        >
          <GtkSourceBuffer
            text={initial}
            language={language}
            styleScheme={scheme}
            highlightSyntax
            onChanged={(self) => onChange(text(self))}
          />
        </GtkSourceView>
      </AdwClampScrollable>
    </GtkScrolledWindow>
  )
}
