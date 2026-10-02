import { _ } from '@gnomeola/ui-core/i18n'
import { useEffect, useRef } from 'react'
import { Dialog, Kbd } from '../../design/primitives/index.ts'

// Keyboard shortcuts: the GTK app's action accels (Ctrl+, Preferences, Ctrl+W close) plus the window's
// own, one table that both drives the handler and is the help dialog (Ctrl+?). "Ctrl" is ⌘ on macOS.

export type ShortcutAction =
  | 'preferences'
  | 'close-window'
  | 'quit'
  | 'search'
  | 'record'
  | 'pause'
  | 'shortcuts'
  | 'menu'
  | 'ask'
  | 'transcript'
  | 'refresh-calendar'

type Shortcut = { action: ShortcutAction; keys: string; label: () => string; group: () => string }

const general = () => _('General')
const recording = () => _('Recording')
const meeting = () => _('Meeting')

export const SHORTCUTS: readonly Shortcut[] = [
  { action: 'preferences', keys: 'Ctrl+,', label: () => _('Preferences'), group: general },
  { action: 'shortcuts', keys: 'Ctrl+?', label: () => _('Keyboard shortcuts'), group: general },
  { action: 'menu', keys: 'F10', label: () => _('Main menu'), group: general },
  { action: 'search', keys: 'Ctrl+F', label: () => _('Search your meetings'), group: general },
  { action: 'refresh-calendar', keys: 'F5', label: () => _('Refresh calendar'), group: general },
  { action: 'close-window', keys: 'Ctrl+W', label: () => _('Close window'), group: general },
  { action: 'quit', keys: 'Ctrl+Q', label: () => _('Quit'), group: general },
  { action: 'record', keys: 'Ctrl+R', label: () => _('New recording, or stop recording'), group: recording },
  { action: 'pause', keys: 'Ctrl+Shift+P', label: () => _('Pause or resume recording'), group: recording },
  { action: 'ask', keys: 'Ctrl+K', label: () => _('Ask about this meeting'), group: meeting },
  { action: 'transcript', keys: 'Ctrl+T', label: () => _('Show or hide the transcript'), group: meeting },
]

/** Does this keydown match "Ctrl+Shift+P"-style keys? `mac`: Ctrl means ⌘. */
export function matches(
  e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
  keys: string,
  mac = false,
): boolean {
  const parts = keys.split(/\+(?!$)/)
  const key = parts.at(-1)!
  const want = new Set(parts.slice(0, -1))
  const primary = mac ? e.metaKey : e.ctrlKey
  if (want.has('Ctrl') !== primary) return false
  if (mac ? e.ctrlKey : e.metaKey) return false
  if (e.altKey !== want.has('Alt')) return false
  // "?" is Shift+/ on most layouts: don't require the Shift modifier to be spelled out for it
  if (key !== '?' && e.shiftKey !== want.has('Shift')) return false
  return e.key.toLowerCase() === key.toLowerCase()
}

/** Window-wide handler: calls `on(action)` and swallows the key when it matched. */
export function useShortcuts(on: (a: ShortcutAction) => void, mac: boolean): void {
  const ref = useRef(on)
  ref.current = on
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      const s = SHORTCUTS.find((x) => matches(e, x.keys, mac))
      if (!s) return
      e.preventDefault()
      ref.current(s.action)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mac])
}

const display = (keys: string, mac: boolean) => (mac ? keys.replace(/Ctrl/g, '⌘') : keys)

export function ShortcutsDialog({ onClose, mac }: { onClose: () => void; mac: boolean }) {
  const groups = [...new Set(SHORTCUTS.map((s) => s.group()))]
  return (
    <Dialog title={_('Keyboard Shortcuts')} isOpen onOpenChange={(o) => !o && onClose()} size="sm">
      <div className="flex flex-col gap-5">
        {groups.map((g) => (
          <section key={g} aria-label={g} className="flex flex-col gap-2">
            <h3 className="m-0 type-overline text-text-secondary">{g}</h3>
            <dl className="m-0 flex flex-col gap-1.5">
              {SHORTCUTS.filter((s) => s.group() === g).map((s) => (
                <div key={s.action} className="flex items-center justify-between gap-4">
                  <dt className="type-callout text-text-primary">{s.label()}</dt>
                  <dd className="m-0">
                    <Kbd>{display(s.keys, mac)}</Kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  )
}
