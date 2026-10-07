import type { Session } from '@kacola/protocol'
import type { DaemonStatus } from '../shared/bridge.ts'

// macOS menu-bar Tray (background mode there: the window closes, the app stays in the menu bar). The
// menu is a pure function of what main knows — the daemon's state and the active recording — so it is
// unit-tested; index.ts turns it into an Electron Menu and runs the actions.
//
// Linux has no tray: GNOME has no StatusNotifier host by default, and the top-bar extension is the
// menu-bar surface there.

export type TrayAction = 'record' | 'stop' | 'pause' | 'resume' | 'open' | 'quit'

export type TrayItem =
  | { type: 'item'; id: TrayAction; label: string; enabled: boolean }
  | { type: 'status'; label: string }
  | { type: 'separator' }

export type TrayModelInput = {
  daemon: DaemonStatus
  /** The recording or paused session, if any. */
  active: Pick<Session, 'status' | 'title' | 'private'> | null
}

const up = (d: DaemonStatus) => d.kind === 'attached' || d.kind === 'spawned'

export function trayStatusLine(i: TrayModelInput): string {
  if (!up(i.daemon)) return i.daemon.kind === 'unreachable' ? 'kacola is not reachable' : 'Starting…'
  if (!i.active) return 'Not recording'
  const title = i.active.private ? 'Private meeting' : i.active.title || 'Untitled meeting'
  return i.active.status === 'paused' ? `Paused: ${title}` : `Recording: ${title}`
}

export function trayMenuModel(i: TrayModelInput): TrayItem[] {
  const ready = up(i.daemon)
  const status = i.active?.status
  const items: TrayItem[] = [{ type: 'status', label: trayStatusLine(i) }, { type: 'separator' }]
  if (status === 'recording' || status === 'paused') {
    items.push(
      status === 'paused'
        ? { type: 'item', id: 'resume', label: 'Resume Recording', enabled: ready }
        : { type: 'item', id: 'pause', label: 'Pause Recording', enabled: ready },
      { type: 'item', id: 'stop', label: 'Stop Recording', enabled: ready },
    )
  } else items.push({ type: 'item', id: 'record', label: 'Record', enabled: ready })
  items.push(
    { type: 'separator' },
    { type: 'item', id: 'open', label: 'Open kacola', enabled: true },
    { type: 'item', id: 'quit', label: 'Quit kacola', enabled: true },
  )
  return items
}

/** The tray icon's tooltip / title. */
export function trayTooltip(i: TrayModelInput): string {
  return `kacola — ${trayStatusLine(i)}`
}
