import type { AutoRecordSettings, CalendarStatus, Meeting, Session } from '@gnomeola/protocol'
import type { DbusMeeting, DbusProps } from './bridge-protocol.ts'

// C-4: every property of org.gnome.Gnomeola as a pure function of daemon state, so what the top bar
// shows is decided (and unit-tested) here and the bridge only transports it.
//
// Private sessions (X-7) are shown as recording — the user must be able to see and stop a capture —
// but with a generic title and no transcript line: the session bus is readable by every process of the
// user, which is exactly the audience the private flag keeps a session away from.

export const PRIVATE_TITLE = 'Private meeting'
const MAX_LINE = 160

export function dbusMeeting(m: Meeting | null): DbusMeeting | Record<string, never> {
  if (!m) return {}
  return {
    id: m.id,
    title: m.title,
    start: Date.parse(m.start),
    end: Date.parse(m.end),
    allDay: m.allDay,
    joinUrl: m.join?.url ?? '',
    provider: m.join?.provider ?? '',
    calendar: m.calendar.name,
    location: m.location ?? '',
    response: m.response ?? '',
  }
}

export type ViewInput = {
  session: Session | null
  timing: { accumulatedMs: number; runningSince: number | null } | null
  lastLine: { speaker: string; text: string } | null
  current: Meeting | null
  next: Meeting | null
  upcoming: Meeting[]
  calendar: CalendarStatus
  autoRecord: AutoRecordSettings
  url: string
  version: string
}

/** Collapse whitespace and keep the tail of long lines — the newest words are the interesting ones. */
export function clipLine(text: string, max = MAX_LINE): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `…${t.slice(t.length - (max - 1)).replace(/^\S*\s/, '')}`
}

export function dbusView(v: ViewInput): DbusProps {
  const s =
    v.session && (v.session.status === 'recording' || v.session.status === 'paused') ? v.session : null
  const priv = s?.private ?? false
  const line = s && !priv && v.lastLine ? v.lastLine : null
  return {
    State: s ? (s.status as 'recording' | 'paused') : 'idle',
    SessionId: s?.id ?? '',
    SessionTitle: s ? (priv ? PRIVATE_TITLE : s.title) : '',
    SessionMeetingId: priv ? '' : (s?.meeting?.id ?? ''),
    ElapsedMs: s ? (v.timing?.accumulatedMs ?? s.durationMs) : 0,
    RunningSince: s && s.status === 'recording' ? (v.timing?.runningSince ?? 0) : 0,
    LastLine: line ? clipLine(line.text) : '',
    LastSpeaker: line?.speaker ?? '',
    CurrentMeeting: dbusMeeting(v.current),
    NextMeeting: dbusMeeting(v.next),
    UpcomingMeetings: v.upcoming.map((m) => dbusMeeting(m) as DbusMeeting),
    CalendarState: v.calendar.state,
    CalendarDetail: v.calendar.detail ?? '',
    AutoRecord: (['calendar', 'micActivity'] as const).filter((k) => v.autoRecord[k]),
    DaemonUrl: v.url,
    Version: v.version,
  }
}

/** The properties whose values differ between two views (deep, by JSON). */
export function changedProps(prev: Partial<DbusProps>, next: DbusProps): Partial<DbusProps> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(next)) {
    if (JSON.stringify(prev[k as keyof DbusProps]) !== JSON.stringify(v)) out[k] = v
  }
  return out as Partial<DbusProps>
}
