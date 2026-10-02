import type { AgendaSummary, Meeting, Session } from '@gnomeola/protocol'
import { _, fmt } from '@gnomeola/ui-core/i18n'

// Home is your day (unit-tested in test/day.test.ts): today's calendar meetings and recordings in one
// strict time order, the next meeting expanded, a recording under way pinned on top, then earlier days.
// Pure: sessions, meetings and agendas in, rows out. Calendar words are local time, like the rest of
// the window.

const DAY = 86_400_000
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const pad2 = (n: number) => String(n).padStart(2, '0')
const startOfDay = (t: number) => {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** "09:30": a 24-hour wall-clock time, mono on screen. */
export function clock(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** "12 min", "1 h 30 min", "2 h", "under 1 min": a length written out, never a stopwatch ("12:00"). */
export function durationLabel(ms: number): string {
  const min = Math.round((Number.isFinite(ms) ? Math.max(0, ms) : 0) / 60_000)
  if (min < 1) return _('under 1 min')
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return fmt(_('{m} min'), { m })
  return m ? fmt(_('{h} h {m} min'), { h, m }) : fmt(_('{h} h'), { h })
}

/** "Thursday 12 March": the long date a day heading carries. */
export function longDate(t: number): string {
  const d = new Date(t)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** "Today", "Yesterday", a weekday within the week, else "12 March" ("12 March 2025" in another year). */
export function dayLabel(t: number, now: number): string {
  const day = startOfDay(t)
  const today = startOfDay(now)
  if (day === today) return _('Today')
  if (day === today - DAY) return _('Yesterday')
  const d = new Date(t)
  if (day > today - 7 * DAY && day < today) return WEEKDAYS[d.getDay()]!
  const dm = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return d.getFullYear() === new Date(now).getFullYear() ? dm : `${dm} ${d.getFullYear()}`
}

/** "in 8 min", "in 1 h 5 min", "now", "ended". */
export function countdown(startIso: string, endIso: string, now: number): string {
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  if (now >= end) return _('ended')
  if (now >= start) return _('now')
  return fmt(_('in {duration}'), { duration: durationLabel(Math.ceil((start - now) / 60_000) * 60_000) })
}

const sessionStart = (s: Session) => Date.parse(s.startedAt ?? s.createdAt)
const isLive = (s: Session) => s.status === 'recording' || s.status === 'paused'

export type DayEntry =
  | {
      kind: 'meeting'
      key: string
      at: number
      meeting: Meeting
      agenda: AgendaSummary | null
      /** The recording of this occurrence, once there is one. */
      session: Session | null
    }
  | { kind: 'recording'; key: string; at: number; session: Session; agenda: AgendaSummary | null }

export type EarlierDay = { key: string; label: string; date: string; sessions: Session[] }

export type Day = {
  /** A recording under way (recording or paused): pinned above the day. */
  live: Session | null
  today: DayEntry[]
  /** The key of the one entry drawn expanded: the next meeting that has not been recorded yet. */
  next: string | null
  earlier: EarlierDay[]
}

/** The agenda of a calendar occurrence (same match as the daemon's link: uid + occurrence). */
export function agendaOf(m: Meeting, agendas: readonly AgendaSummary[]): AgendaSummary | null {
  return (
    agendas.find(
      (a) =>
        a.meeting?.eventUid === m.uid &&
        (a.meeting.meetingId === m.id || a.meeting.recurrenceId === m.recurrenceId || !m.recurring),
    ) ?? null
  )
}

export function buildDay(
  sessions: readonly Session[],
  meetings: readonly Meeting[],
  agendas: readonly AgendaSummary[],
  now: number,
): Day {
  const today = startOfDay(now)
  const tomorrow = today + DAY
  const agendaBySession = new Map(agendas.filter((a) => a.sessionId).map((a) => [a.sessionId!, a]))
  const live = sessions.find(isLive) ?? null
  const used = new Set<string>()
  const entries: DayEntry[] = []
  for (const m of meetings) {
    const start = Date.parse(m.start)
    if (m.allDay || m.status === 'cancelled' || start < today || start >= tomorrow) continue
    const agenda = agendaOf(m, agendas)
    const session =
      sessions.find((s) => s.meeting?.id === m.id) ??
      (agenda?.sessionId ? sessions.find((s) => s.id === agenda.sessionId) : undefined) ??
      null
    if (session) used.add(session.id)
    entries.push({ kind: 'meeting', key: `m:${m.id}`, at: start, meeting: m, agenda, session })
  }
  const earlier = new Map<number, Session[]>()
  for (const s of sessions) {
    if (used.has(s.id)) continue
    const at = sessionStart(s)
    if (at >= today && at < tomorrow)
      entries.push({
        kind: 'recording',
        key: `s:${s.id}`,
        at,
        session: s,
        agenda: agendaBySession.get(s.id) ?? null,
      })
    else if (at < today) {
      const day = startOfDay(at)
      earlier.set(day, [...(earlier.get(day) ?? []), s])
    }
  }
  entries.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key))
  const next =
    entries.find(
      (e) =>
        e.kind === 'meeting' &&
        !e.session &&
        Date.parse(e.meeting.end) > now &&
        e.meeting.status !== 'cancelled',
    )?.key ?? null
  return {
    live,
    today: entries,
    next,
    earlier: [...earlier.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([day, list]) => ({
        key: String(day),
        label: dayLabel(day, now),
        date: longDate(day),
        sessions: [...list].sort((a, b) => sessionStart(a) - sessionStart(b)),
      })),
  }
}

export type Readiness = { ok: true; text: string } | { ok: false; text: string; fix: 'models' | 'daemon' }

/** "Recording will work", or the one thing that stops it, with what fixes it. */
export function readiness(o: { missingModels: number; connected: boolean }): Readiness {
  if (!o.connected) return { ok: false, text: _('kacola isn’t answering right now'), fix: 'daemon' }
  if (o.missingModels > 0) return { ok: false, text: _('Speech models aren’t downloaded yet'), fix: 'models' }
  return { ok: true, text: _('Recording will work') }
}
