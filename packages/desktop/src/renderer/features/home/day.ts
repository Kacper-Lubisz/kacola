import type { AgendaSummary, Meeting, Session } from '@kacola/protocol'
import { _, fmt } from '@kacola/ui-core/i18n'

// Home is your day (unit-tested in test/day.test.ts): today's calendar meetings and recordings latest
// first — the end of the day at the top, down through now, to this morning — with what is under way
// marked current in its own place (no pinned card), the now line's place when nothing is, the soonest
// meeting still to come, all-day events apart, then earlier days (each latest first too). Calendars
// as they really come: one invitation copied into several calendars is one row; declined and cancelled
// ones are left out. Pure: sessions, meetings and agendas in, rows out. Local time, like the window.

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

/**
 * When a meeting is, said plainly: "starting in 2 min", "starting in 1 h 5 min"; "just started",
 * "started 10 min ago" once under way; "ended".
 */
export function countdown(startIso: string, endIso: string, now: number): string {
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  if (now >= end) return _('ended')
  if (now >= start) {
    const ago = Math.floor((now - start) / 60_000) * 60_000
    return ago < 60_000
      ? _('just started')
      : fmt(_('started {duration} ago'), { duration: durationLabel(ago) })
  }
  return fmt(_('starting in {duration}'), {
    duration: durationLabel(Math.ceil((start - now) / 60_000) * 60_000),
  })
}

const sessionStart = (s: Session) => Date.parse(s.startedAt ?? s.createdAt)
const isLive = (s: Session) => s.status === 'recording' || s.status === 'paused'

export type DayEntry =
  | {
      kind: 'meeting'
      key: string
      /** Where it sits on the timeline: its start (today's midnight for one that began yesterday). */
      at: number
      meeting: Meeting
      agenda: AgendaSummary | null
      /** The recording of this occurrence, once there is one. */
      session: Session | null
      /** Under way: start ≤ now < end, or its recording is running. */
      current: boolean
    }
  | {
      kind: 'recording'
      key: string
      at: number
      session: Session
      agenda: AgendaSummary | null
      /** Recording (or paused) right now. */
      current: boolean
    }

export type EarlierDay = { key: string; label: string; date: string; sessions: Session[] }

export type Day = {
  /** Today's all-day events (a holiday, a birthday, an offsite): a quiet strip, not on the timeline. */
  allDay: Meeting[]
  /**
   * Today, latest first: what is still to come at the top, down through now, to this morning. What is
   * under way (`current`) sits in its own place and marks now.
   */
  today: DayEntry[]
  /**
   * Where the now line goes: before `today[nowAt]` (`today.length` = after the last). Null when
   * something is current (it marks now itself) or the day is empty.
   */
  nowAt: number | null
  /** The soonest meeting still to come, unrecorded (just above now in this order). */
  soonest: string | null
  /** The one entry drawn expanded: `soonest`, but only while nothing is current (two big cards never compete). */
  next: string | null
  /** Earlier days, latest first; each day's recordings latest first, like today. */
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

const RESPONSE_RANK: Record<string, number> = { accepted: 0, tentative: 1, 'needs-action': 2, delegated: 3 }
/** Which copy of a duplicated invitation to keep: the one with a join link, then the one I answered. */
const better = (a: Meeting, b: Meeting) =>
  (a.join ? 0 : 1) - (b.join ? 0 : 1) ||
  (RESPONSE_RANK[a.response ?? ''] ?? 4) - (RESPONSE_RANK[b.response ?? ''] ?? 4) ||
  a.id.localeCompare(b.id)

/**
 * One row per meeting: the same invitation copied into several calendars (a shared team calendar, a
 * personal one) arrives once per calendar, sometimes under different UIDs. Same title, start and end is
 * the same meeting. Declined and cancelled ones are not on the day at all.
 */
export function dedupeMeetings(meetings: readonly Meeting[]): Meeting[] {
  const kept = new Map<string, Meeting>()
  for (const m of meetings) {
    if (m.status === 'cancelled' || m.response === 'declined') continue
    const k = `${m.title.trim().toLowerCase()}|${Date.parse(m.start)}|${Date.parse(m.end)}`
    const cur = kept.get(k)
    if (!cur || better(m, cur) < 0) kept.set(k, m)
  }
  return [...kept.values()]
}

const endOf = (e: DayEntry) =>
  e.kind === 'meeting'
    ? Date.parse(e.meeting.end)
    : e.current
      ? Number.POSITIVE_INFINITY
      : sessionStart(e.session) + (e.session.durationMs || 0)

export function buildDay(
  sessions: readonly Session[],
  meetings: readonly Meeting[],
  agendas: readonly AgendaSummary[],
  now: number,
): Day {
  const today = startOfDay(now)
  const tomorrow = today + DAY
  const agendaBySession = new Map(agendas.filter((a) => a.sessionId).map((a) => [a.sessionId!, a]))
  const used = new Set<string>()
  const entries: DayEntry[] = []
  const allDay: Meeting[] = []
  for (const m of dedupeMeetings(meetings)) {
    const start = Date.parse(m.start)
    const end = Date.parse(m.end)
    // on today at all: overlaps [today, tomorrow) — an all-day event spanning the week, a timed one
    // that began last night
    if (!(start < tomorrow && Math.max(end, start + 1) > today)) continue
    if (m.allDay) {
      allDay.push(m)
      continue
    }
    const agenda = agendaOf(m, agendas)
    const session =
      sessions.find((s) => s.meeting?.id === m.id && !used.has(s.id)) ??
      (agenda?.sessionId ? sessions.find((s) => s.id === agenda.sessionId && !used.has(s.id)) : undefined) ??
      null
    if (session) used.add(session.id)
    entries.push({
      kind: 'meeting',
      key: `m:${m.id}`,
      at: Math.max(start, today),
      meeting: m,
      agenda,
      session,
      current: (start <= now && now < end) || (session !== null && isLive(session)),
    })
  }
  const earlier = new Map<number, Session[]>()
  for (const s of sessions) {
    if (used.has(s.id)) continue
    const at = sessionStart(s)
    // a recording under way is today's whenever it began (one left running since last night included)
    if (isLive(s) || (at >= today && at < tomorrow))
      entries.push({
        kind: 'recording',
        key: `s:${s.id}`,
        at: Math.max(at, today),
        session: s,
        agenda: agendaBySession.get(s.id) ?? null,
        current: isLive(s),
      })
    else if (at < today) {
      const day = startOfDay(at)
      earlier.set(day, [...(earlier.get(day) ?? []), s])
    }
  }
  // latest first; at the same minute, the one that ends later (or is still running) above
  entries.sort((a, b) => b.at - a.at || endOf(b) - endOf(a) || a.key.localeCompare(b.key))
  const anyCurrent = entries.some((e) => e.current)
  let nowAt: number | null = null
  if (!anyCurrent && entries.length) {
    const i = entries.findIndex((e) => e.at <= now)
    nowAt = i < 0 ? entries.length : i
  }
  // the soonest meeting still to come: the lowest one above now in this order
  const upcoming = entries.filter(
    (e) => e.kind === 'meeting' && !e.session && !e.current && Date.parse(e.meeting.start) > now,
  )
  return {
    allDay: allDay.sort(
      (a, b) => Date.parse(a.start) - Date.parse(b.start) || a.title.localeCompare(b.title),
    ),
    today: entries,
    nowAt,
    soonest: upcoming.at(-1)?.key ?? null,
    next: anyCurrent ? null : (upcoming.at(-1)?.key ?? null),
    earlier: [...earlier.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([day, list]) => ({
        key: String(day),
        label: dayLabel(day, now),
        date: longDate(day),
        sessions: [...list].sort((a, b) => sessionStart(b) - sessionStart(a)),
      })),
  }
}

/** A recording too short to hold anything (a misclick, a test): drawn quietly. */
export const isShortRecording = (s: Session) => !isLive(s) && (s.durationMs ?? 0) < 60_000

export type Readiness = { ok: true; text: string } | { ok: false; text: string; fix: 'models' | 'daemon' }

/** "Recording will work", or the one thing that stops it, with what fixes it. */
export function readiness(o: { missingModels: number; connected: boolean }): Readiness {
  if (!o.connected) return { ok: false, text: _('kacola isn’t answering right now'), fix: 'daemon' }
  if (o.missingModels > 0) return { ok: false, text: _('Speech models aren’t downloaded yet'), fix: 'models' }
  return { ok: true, text: _('Recording will work') }
}
