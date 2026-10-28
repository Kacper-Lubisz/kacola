import type { CalendarStatus, Meeting, Session } from '@kacola/protocol'
import type { DaemonStatus } from '../shared/bridge.ts'

// macOS menu-bar Tray (background mode there: the window closes, the app stays in the menu bar). The
// menu is a pure function of what main knows — the daemon's state and the active recording — so it is
// unit-tested; index.ts turns it into an Electron Menu (headers, sublabels and SF Symbols) and runs the
// actions. The title beside the icon (macOS only) is the meeting worth a glance — on now, or next today —
// behind a dot while kacola records.
//
// Linux has no tray: GNOME has no StatusNotifier host by default, and the top-bar extension is the
// menu-bar surface there.

export type TrayAction =
  | 'record'
  | 'record-meeting'
  | 'stop'
  | 'pause'
  | 'resume'
  | 'discard'
  | 'open-recording'
  | 'allow-calendar'
  | 'open'
  | 'quit'

/** Each is an SF Symbol in index.ts. */
export type TraySymbol = 'record' | 'pause' | 'resume' | 'stop' | 'discard' | 'calendar' | 'open'

export type TrayItem =
  | { type: 'header'; label: string }
  | {
      type: 'item'
      id: TrayAction
      label: string
      sublabel?: string
      symbol?: TraySymbol
      enabled: boolean
    }
  | { type: 'status'; label: string; sublabel?: string | undefined }
  | { type: 'separator' }

export type TrayModelInput = {
  daemon: DaemonStatus
  /** The recording or paused session, if any. */
  active:
    | (Pick<Session, 'status' | 'title' | 'private'> &
        Partial<Pick<Session, 'startedAt'>> & { meeting?: Pick<NonNullable<Session['meeting']>, 'id'> })
    | null
  /** An auto-record rule started the active recording (worth saying, so a wrong one is easy to discard). */
  activeAuto?: boolean
  /** What GET /meetings/next last answered; null until it has. */
  meetings: {
    current: TrayMeeting | null
    next: TrayMeeting | null
    calendar: Pick<CalendarStatus, 'state'>
  } | null
  /** Epoch ms. */
  now: number
  /** kacola may not read the calendars (and the user can allow it): the menu offers setup's Calendar step. */
  calendarMissing?: boolean
}

export type TrayMeeting = Pick<Meeting, 'id' | 'title' | 'start' | 'end'>

const up = (d: DaemonStatus) => d.kind === 'attached' || d.kind === 'spawned'

const activeTitle = (a: NonNullable<TrayModelInput['active']>) =>
  a.private ? 'Private meeting' : a.title.trim() || 'Untitled meeting'

export function trayStatusLine(i: TrayModelInput): string {
  if (!up(i.daemon)) return i.daemon.kind === 'unreachable' ? 'kacola is not reachable' : 'Starting…'
  if (!i.active) return 'Not recording'
  return `${i.active.status === 'paused' ? 'Paused' : 'Recording'}: ${activeTitle(i.active)}`
}

const MINUTE = 60_000
/** The menu-bar title's budget: the whole title, ellipsis included. */
const TITLE_MAX = 22

type Glance = { meeting: TrayMeeting; at: 'now' | 'soon' | 'later'; minutes: number }

const sameLocalDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString()

/**
 * The meeting worth a glance: the one in progress, else the next one when it starts within the hour or
 * later today. Judged against `now`, not the daemon's answer, which can be up to a refresh old.
 */
export function glanceMeeting(i: TrayModelInput): Glance | null {
  const c = i.meetings
  if (!up(i.daemon) || !c || c.calendar.state !== 'ok') return null
  const live = [c.current, c.next].find((m) => m && Date.parse(m.start) <= i.now && i.now < Date.parse(m.end))
  if (live) return { meeting: live, at: 'now', minutes: 0 }
  const next = c.next
  const start = next ? Date.parse(next.start) : Number.NaN
  if (!next || !(start > i.now)) return null
  const minutes = Math.ceil((start - i.now) / MINUTE)
  if (minutes < 60) return { meeting: next, at: 'soon', minutes }
  return sameLocalDay(start, i.now) ? { meeting: next, at: 'later', minutes } : null
}

const pad2 = (n: number) => String(n).padStart(2, '0')
/** Local `HH:MM`, like every other time kacola shows. */
const clock = (iso: string) => {
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** Cut to `max` characters (code points, so an emoji is never split), ending in an ellipsis when cut. */
function truncate(s: string, max: number): string {
  const chars = [...s]
  if (chars.length <= max) return s
  const head = chars.slice(0, max - 1).join('')
  return `${head.trimEnd()}…`
}

const meetingTitle = (m: TrayMeeting) => m.title.trim() || 'Untitled meeting'

/**
 * The text beside the menu-bar icon: `now: Standup`, `Standup in 12 min`, `10:30 Standup`, or nothing.
 * While recording it starts with `●` (`‖` paused): `● now: Standup` while the meeting is on, else the
 * recording's own title.
 */
export function trayTitle(i: TrayModelInput): string {
  const g = glanceMeeting(i)
  const fit = (before: string, title: string, after = '') =>
    `${before}${truncate(title, TITLE_MAX - [...before].length - after.length)}${after}`
  if (i.active) {
    const dot = i.active.status === 'paused' ? '‖ ' : '● '
    return g && recordsGlance(i.active, g)
      ? fit(`${dot}now: `, meetingTitle(g.meeting))
      : fit(dot, activeTitle(i.active))
  }
  if (!g) return ''
  const title = meetingTitle(g.meeting)
  if (g.at === 'now') return fit('now: ', title)
  if (g.at === 'soon') return fit('', title, ` in ${g.minutes} min`)
  return fit(`${clock(g.meeting.start)} `, title)
}

/** The recording is of the meeting on now (a rule or Join linked it). */
const recordsGlance = (a: NonNullable<TrayModelInput['active']>, g: Glance) =>
  g.at === 'now' && a.meeting?.id === g.meeting.id

/** When the glance meeting is: `until 11:00`, `10:30 · in 12 min`, `10:30`. */
function whenLine(g: Glance): string {
  if (g.at === 'now') return `until ${clock(g.meeting.end)}`
  return g.at === 'soon' ? `${clock(g.meeting.start)} · in ${g.minutes} min` : clock(g.meeting.start)
}

/** A sublabel from its parts, joined with ` · ` and capitalised. */
function sublabel(...parts: (string | null)[]): string | undefined {
  const s = parts.filter((p) => p !== null).join(' · ')
  return s ? `${s[0]!.toUpperCase()}${s.slice(1)}` : undefined
}

/**
 *   Recording / Paused       (header)
 *     Standup                Started automatically · until 11:00
 *     Pause · Stop · Discard Recording…
 *   Now / Next               (header; not repeated when the recording is that meeting)
 *     Planning               10:30 · in 12 min
 *     Record This Meeting    (a meeting on now: recorded linked and titled, as Join)
 *   Record · Allow Calendar Access… · Open kacola · Quit kacola
 */
export function trayMenuModel(i: TrayModelInput): TrayItem[] {
  const ready = up(i.daemon)
  const a = i.active
  const g = glanceMeeting(i)
  const items: TrayItem[] = []
  if (!ready) items.push({ type: 'status', label: trayStatusLine(i) }, { type: 'separator' })

  const recordingThis = a !== null && g !== null && recordsGlance(a, g)
  if (a) {
    const when = recordingThis ? whenLine(g) : a.startedAt ? `since ${clock(a.startedAt)}` : null
    const sub = sublabel(i.activeAuto ? 'started automatically' : null, when)
    items.push(
      { type: 'header', label: a.status === 'paused' ? 'Paused' : 'Recording' },
      {
        type: 'item',
        id: 'open-recording',
        label: truncate(activeTitle(a), 48),
        ...(sub ? { sublabel: sub } : {}),
        enabled: true,
      },
      a.status === 'paused'
        ? { type: 'item', id: 'resume', label: 'Resume Recording', symbol: 'resume', enabled: ready }
        : { type: 'item', id: 'pause', label: 'Pause Recording', symbol: 'pause', enabled: ready },
      { type: 'item', id: 'stop', label: 'Stop Recording', symbol: 'stop', enabled: ready },
      { type: 'item', id: 'discard', label: 'Discard Recording…', symbol: 'discard', enabled: ready },
      { type: 'separator' },
    )
  }

  if (g && !recordingThis) {
    items.push(
      { type: 'header', label: g.at === 'now' ? 'Now' : 'Next' },
      { type: 'status', label: truncate(meetingTitle(g.meeting), 48), sublabel: sublabel(whenLine(g)) },
    )
    if (!a && g.at === 'now')
      items.push({
        type: 'item',
        id: 'record-meeting',
        label: 'Record This Meeting',
        symbol: 'record',
        enabled: ready,
      })
    items.push({ type: 'separator' })
  }

  if (!a && g?.at !== 'now')
    items.push({ type: 'item', id: 'record', label: 'Record', symbol: 'record', enabled: ready })
  if (i.calendarMissing)
    items.push({
      type: 'item',
      id: 'allow-calendar',
      label: 'Allow Calendar Access…',
      symbol: 'calendar',
      enabled: true,
    })
  if (items.at(-1)?.type !== 'separator') items.push({ type: 'separator' })
  items.push(
    { type: 'item', id: 'open', label: 'Open kacola', symbol: 'open', enabled: true },
    { type: 'item', id: 'quit', label: 'Quit kacola', enabled: true },
  )
  return items
}

/** The tray icon's tooltip. */
export function trayTooltip(i: TrayModelInput): string {
  return `kacola — ${trayStatusLine(i)}`
}
