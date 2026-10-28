import type { CalendarStatus, Meeting, Session } from '@kacola/protocol'
import type { DaemonStatus } from '../shared/bridge.ts'

// macOS menu-bar Tray (background mode there: the window closes, the app stays in the menu bar). The
// menu is a pure function of what main knows — the daemon's state and the active recording — so it is
// unit-tested; index.ts turns it into an Electron Menu and runs the actions. The title beside the icon
// (macOS only) is the meeting worth a glance: on now, or next today.
//
// Linux has no tray: GNOME has no StatusNotifier host by default, and the top-bar extension is the
// menu-bar surface there.

export type TrayAction = 'record' | 'stop' | 'pause' | 'resume' | 'allow-calendar' | 'open' | 'quit'

export type TrayItem =
  | { type: 'item'; id: TrayAction; label: string; enabled: boolean }
  | { type: 'status'; label: string }
  | { type: 'separator' }

export type TrayModelInput = {
  daemon: DaemonStatus
  /** The recording or paused session, if any. */
  active: Pick<Session, 'status' | 'title' | 'private'> | null
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

export type TrayMeeting = Pick<Meeting, 'title' | 'start' | 'end'>

const up = (d: DaemonStatus) => d.kind === 'attached' || d.kind === 'spawned'

export function trayStatusLine(i: TrayModelInput): string {
  if (!up(i.daemon)) return i.daemon.kind === 'unreachable' ? 'kacola is not reachable' : 'Starting…'
  if (!i.active) return 'Not recording'
  const title = i.active.private ? 'Private meeting' : i.active.title || 'Untitled meeting'
  return i.active.status === 'paused' ? `Paused: ${title}` : `Recording: ${title}`
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
 * A recording keeps the menu bar to itself.
 */
export function trayTitle(i: TrayModelInput): string {
  if (i.active) return ''
  const g = glanceMeeting(i)
  if (!g) return ''
  const fit = (before: string, after: string) =>
    `${before}${truncate(meetingTitle(g.meeting), TITLE_MAX - before.length - after.length)}${after}`
  if (g.at === 'now') return fit('now: ', '')
  if (g.at === 'soon') return fit('', ` in ${g.minutes} min`)
  return fit(`${clock(g.meeting.start)} `, '')
}

/** The menu's line about that meeting, or null when there is none. */
export function trayMeetingLine(i: TrayModelInput): string | null {
  const g = glanceMeeting(i)
  if (!g) return null
  const title = truncate(meetingTitle(g.meeting), 48)
  if (g.at === 'now') return `Now: ${title} (until ${clock(g.meeting.end)})`
  if (g.at === 'soon') return `Next: ${title} in ${g.minutes} min`
  return `Next: ${title} at ${clock(g.meeting.start)}`
}

export function trayMenuModel(i: TrayModelInput): TrayItem[] {
  const ready = up(i.daemon)
  const status = i.active?.status
  const meeting = trayMeetingLine(i)
  const items: TrayItem[] = [
    { type: 'status', label: trayStatusLine(i) },
    ...(meeting ? [{ type: 'status' as const, label: meeting }] : []),
    { type: 'separator' },
  ]
  if (status === 'recording' || status === 'paused') {
    items.push(
      status === 'paused'
        ? { type: 'item', id: 'resume', label: 'Resume Recording', enabled: ready }
        : { type: 'item', id: 'pause', label: 'Pause Recording', enabled: ready },
      { type: 'item', id: 'stop', label: 'Stop Recording', enabled: ready },
    )
  } else items.push({ type: 'item', id: 'record', label: 'Record', enabled: ready })
  if (i.calendarMissing)
    items.push(
      { type: 'separator' },
      { type: 'item', id: 'allow-calendar', label: 'Allow Calendar Access…', enabled: true },
    )
  items.push(
    { type: 'separator' },
    { type: 'item', id: 'open', label: 'Open kacola', enabled: true },
    { type: 'item', id: 'quit', label: 'Quit kacola', enabled: true },
  )
  return items
}

/** The tray icon's tooltip. */
export function trayTooltip(i: TrayModelInput): string {
  return `kacola — ${trayStatusLine(i)}`
}
