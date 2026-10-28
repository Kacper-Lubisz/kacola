import type { CalendarStatus, JoinLink, Meeting, MeetingProvider, Session } from '@kacola/protocol'
import type { DaemonStatus } from '../shared/bridge.ts'

// macOS menu-bar Tray (background mode there: the window closes, the app stays in the menu bar). The
// menu is a pure function of what main knows — the daemon's state, the active recording and today's
// meetings — so it is unit-tested; index.ts turns it into an Electron Menu (headers, sublabels, SF
// Symbols, a submenu per meeting) and runs the actions. The title beside the icon (macOS only) is the
// meeting worth a glance — on now and when it ends, or next today — behind a dot while kacola records.
//
// Linux has no tray: GNOME has no StatusNotifier host by default, and the top-bar extension is the
// menu-bar surface there.

export type TrayAction =
  | 'record'
  | 'stop'
  | 'pause'
  | 'resume'
  | 'discard'
  | 'open-recording'
  | 'join-record'
  | 'join'
  | 'record-meeting'
  | 'allow-calendar'
  | 'open'
  | 'quit'

/** Each is an SF Symbol in index.ts. */
export type TraySymbol =
  | 'record'
  | 'recording'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'discard'
  | 'video'
  | 'event'
  | 'join'
  | 'calendar-missing'
  | 'open'

export type TrayItem =
  | { type: 'header'; label: string }
  | {
      type: 'item'
      id: TrayAction
      /** The meeting the action is for (join, record a meeting). */
      meetingId?: string
      label: string
      sublabel?: string | undefined
      symbol?: TraySymbol
      enabled: boolean
    }
  | { type: 'submenu'; label: string; sublabel?: string | undefined; symbol?: TraySymbol; items: TrayItem[] }
  | { type: 'status'; label: string; sublabel?: string | undefined }
  | { type: 'separator' }

export type TrayMeeting = Pick<Meeting, 'id' | 'title' | 'start' | 'end'> & {
  join?: Pick<JoinLink, 'url' | 'provider'> | null
  response?: Meeting['response']
}

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
  /** Today's meetings (GET /meetings from local midnight); null until the daemon answered. */
  today?: TrayMeeting[] | null
  /** Epoch ms. */
  now: number
  /** kacola may not read the calendars (and the user can allow it): the menu offers setup's Calendar step. */
  calendarMissing?: boolean
}

const up = (d: DaemonStatus) => d.kind === 'attached' || d.kind === 'spawned'

const activeTitle = (a: NonNullable<TrayModelInput['active']>) =>
  a.private ? 'Private meeting' : a.title.trim() || 'Untitled meeting'

export function trayStatusLine(i: TrayModelInput): string {
  if (!up(i.daemon)) return i.daemon.kind === 'unreachable' ? 'kacola is not reachable' : 'Starting…'
  if (!i.active) return 'Not recording'
  return `${i.active.status === 'paused' ? 'Paused' : 'Recording'}: ${activeTitle(i.active)}`
}

export const PROVIDER_NAMES: Record<MeetingProvider, string | null> = {
  meet: 'Google Meet',
  zoom: 'Zoom',
  teams: 'Microsoft Teams',
  webex: 'Webex',
  jitsi: 'Jitsi',
  whereby: 'Whereby',
  other: null,
}

const MINUTE = 60_000
/** The meeting title's share of the menu-bar title (times and "min left" come on top). */
const TITLE_CHARS = 24
/** At most this many of today's meetings in the menu. */
const AGENDA_MAX = 12

type Glance = { meeting: TrayMeeting; at: 'now' | 'soon' | 'later'; minutes: number }

const sameLocalDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString()
const isLive = (m: TrayMeeting, now: number) => Date.parse(m.start) <= now && now < Date.parse(m.end)

/**
 * The meeting worth a glance: the one in progress, else the next one when it starts within the hour or
 * later today. Judged against `now`, not the daemon's answer, which can be up to a refresh old.
 */
export function glanceMeeting(i: TrayModelInput): Glance | null {
  const c = i.meetings
  if (!up(i.daemon) || !c || c.calendar.state !== 'ok') return null
  const live = [c.current, c.next].find((m) => m && isLive(m, i.now))
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

/** How long a meeting on now has left: `18 min left`, or `until 15:00` an hour or more out. */
function timeLeft(m: TrayMeeting, now: number): string {
  const minutes = Math.ceil((Date.parse(m.end) - now) / MINUTE)
  return minutes < 60 ? `${minutes} min left` : `until ${clock(m.end)}`
}

/** The recording is of this meeting (a rule, Join or the menu linked it). */
const records = (a: TrayModelInput['active'], m: TrayMeeting) => a?.meeting?.id === m.id

/**
 * The text beside the menu-bar icon: `now: Standup · 18 min left`, `Standup in 12 min`, `10:30 Standup`,
 * or nothing. While recording it starts with `●` (`‖` paused): `● now: Standup · 18 min left` while
 * recording the meeting on now, else the recording's own title.
 */
export function trayTitle(i: TrayModelInput): string {
  const g = glanceMeeting(i)
  const title = (m: TrayMeeting) => truncate(meetingTitle(m), TITLE_CHARS)
  const nowLine = (m: TrayMeeting) => `now: ${title(m)} · ${timeLeft(m, i.now)}`
  if (i.active) {
    const dot = i.active.status === 'paused' ? '‖ ' : '● '
    return g?.at === 'now' && records(i.active, g.meeting)
      ? `${dot}${nowLine(g.meeting)}`
      : `${dot}${truncate(activeTitle(i.active), TITLE_CHARS)}`
  }
  if (!g) return ''
  if (g.at === 'now') return nowLine(g.meeting)
  if (g.at === 'soon') return `${title(g.meeting)} in ${g.minutes} min`
  return `${clock(g.meeting.start)} ${title(g.meeting)}`
}

/**
 * What is left of today: meetings not yet over, in order. One per occurrence: a meeting on two calendars
 * (an invitation forwarded to a shared calendar) shows once, the copy with a join link and an answer.
 */
export function todayAgenda(i: TrayModelInput): TrayMeeting[] {
  if (!up(i.daemon) || i.meetings?.calendar.state !== 'ok' || !i.today) return []
  const rank = (m: TrayMeeting) => (m.join ? 2 : 0) + (m.response === 'accepted' ? 1 : 0)
  const byOccurrence = new Map<string, TrayMeeting>()
  for (const m of i.today) {
    if (Date.parse(m.end) <= i.now || !sameLocalDay(Date.parse(m.start), i.now) || m.response === 'declined')
      continue
    const key = `${m.start}|${m.end}|${meetingTitle(m).toLowerCase()}`
    const seen = byOccurrence.get(key)
    if (!seen || rank(m) > rank(seen)) byOccurrence.set(key, m)
  }
  return [...byOccurrence.values()]
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, AGENDA_MAX)
}

/** A sublabel from its parts, joined with ` · ` and capitalised. */
function sublabel(...parts: (string | null | undefined)[]): string | undefined {
  const s = parts.filter((p) => p).join(' · ')
  return s ? `${s[0]!.toUpperCase()}${s.slice(1)}` : undefined
}

/** One of today's meetings: its times and link at a glance, the ways to join or record it inside. */
function agendaItem(m: TrayMeeting, i: TrayModelInput, ready: boolean): TrayItem {
  const recording = records(i.active, m)
  const live = isLive(m, i.now)
  const minutes = Math.ceil((Date.parse(m.start) - i.now) / MINUTE)
  const status = recording
    ? 'recording'
    : live
      ? `now · ${timeLeft(m, i.now)}`
      : minutes < 60
        ? `in ${minutes} min`
        : null
  const meetingId = m.id
  const items: TrayItem[] = recording
    ? [
        ...(m.join
          ? [
              {
                type: 'item' as const,
                id: 'join' as const,
                meetingId,
                label: 'Join Meeting',
                symbol: 'join' as const,
                enabled: true,
              },
            ]
          : []),
        { type: 'item', id: 'open-recording', label: 'Open Recording', enabled: true },
      ]
    : m.join
      ? [
          {
            type: 'item',
            id: 'join-record',
            meetingId,
            label: 'Join & Record',
            symbol: 'record',
            enabled: ready,
          },
          {
            type: 'item',
            id: 'join',
            meetingId,
            label: 'Join Without Recording',
            symbol: 'join',
            enabled: true,
          },
          { type: 'item', id: 'record-meeting', meetingId, label: 'Record Without Joining', enabled: ready },
        ]
      : [{ type: 'item', id: 'record-meeting', meetingId, label: 'Record', symbol: 'record', enabled: ready }]
  return {
    type: 'submenu',
    label: truncate(meetingTitle(m), 40),
    sublabel: sublabel(
      `${clock(m.start)}–${clock(m.end)}`,
      m.join ? PROVIDER_NAMES[m.join.provider] : null,
      status,
    ),
    symbol: recording ? 'recording' : m.join ? 'video' : 'event',
    items,
  }
}

/**
 *   Recording / Paused       (header)
 *     Standup                Started automatically · until 11:00
 *     Pause · Stop · Discard Recording…
 *   Today                    (header)
 *     Standup ›              10:30–11:00 · Zoom · now · 18 min left
 *       Join & Record · Join Without Recording · Record Without Joining
 *     Planning ›             11:00–11:30 · Google Meet · in 20 min
 *   Record · Allow Calendar Access… · Open kacola · Quit kacola
 */
export function trayMenuModel(i: TrayModelInput): TrayItem[] {
  const ready = up(i.daemon)
  const a = i.active
  const items: TrayItem[] = []
  if (!ready) items.push({ type: 'status', label: trayStatusLine(i) }, { type: 'separator' })

  if (a) {
    const g = glanceMeeting(i)
    const ofMeeting = g?.at === 'now' && records(a, g.meeting) ? g.meeting : null
    const when = ofMeeting
      ? `until ${clock(ofMeeting.end)}`
      : a.startedAt
        ? `since ${clock(a.startedAt)}`
        : null
    items.push(
      { type: 'header', label: a.status === 'paused' ? 'Paused' : 'Recording' },
      {
        type: 'item',
        id: 'open-recording',
        label: truncate(activeTitle(a), 48),
        sublabel: sublabel(i.activeAuto ? 'started automatically' : null, when),
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

  if (ready && i.meetings?.calendar.state === 'ok' && i.today) {
    const agenda = todayAgenda(i)
    items.push(
      { type: 'header', label: 'Today' },
      ...(agenda.length
        ? agenda.map((m) => agendaItem(m, i, ready))
        : [{ type: 'status' as const, label: 'Nothing else today' }]),
      { type: 'separator' },
    )
  }

  if (!a) items.push({ type: 'item', id: 'record', label: 'Record', symbol: 'record', enabled: ready })
  if (i.calendarMissing)
    items.push({
      type: 'item',
      id: 'allow-calendar',
      label: 'Allow Calendar Access…',
      symbol: 'calendar-missing',
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
