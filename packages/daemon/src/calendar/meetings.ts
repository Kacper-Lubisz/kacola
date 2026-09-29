import { createHash } from 'node:crypto'
import type { Meeting, MeetingResponse, SessionMeeting } from '@gnomeola/protocol'
import type { RawOccurrence } from './agent-protocol.ts'
import { extractJoinLink } from './join-links.ts'

// C-1 / C-3: from what a calendar provider reports (RawOccurrence) to Meetings, and the questions the
// rest of the daemon asks of them: what is on in a window, what is happening now, what is next.

/** Stable per occurrence (calendar, series, instance), opaque, short enough for a URL path. */
export function meetingId(sourceUid: string, uid: string, recurrenceId: string | null): string {
  const h = createHash('sha256')
    .update(`${sourceUid}\n${uid}\n${recurrenceId ?? ''}`)
    .digest('base64url')
  return `mtg_${h.slice(0, 22)}`
}

const RESPONSES: Record<string, MeetingResponse> = {
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  TENTATIVE: 'tentative',
  'NEEDS-ACTION': 'needs-action',
  DELEGATED: 'delegated',
}

/** Local midnight of a `YYYY-MM-DD` date, as an instant — all-day events are about the user's days. */
export function localMidnight(date: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) throw new Error(`bad date ${date}`)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

export function toMeeting(r: RawOccurrence): Meeting {
  let start = new Date(r.start)
  let end = new Date(r.end)
  if (r.allDay && r.startDate) {
    start = localMidnight(r.startDate)
    end = r.endDate
      ? localMidnight(r.endDate)
      : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
    if (end <= start) end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
  }
  if (end < start) end = start
  const status = r.status.toUpperCase()
  return {
    id: meetingId(r.sourceUid, r.uid, r.recurrenceId),
    uid: r.uid,
    recurrenceId: r.recurrenceId,
    calendar: { id: r.sourceUid, name: r.calendarName },
    title: oneLine(r.summary) || 'Untitled meeting',
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: r.allDay,
    timezone: r.timezone,
    location: oneLine(r.location) || null,
    join: extractJoinLink({ xprops: r.xprops, url: r.url, location: r.location, description: r.description }),
    status: status === 'CANCELLED' ? 'cancelled' : status === 'TENTATIVE' ? 'tentative' : 'confirmed',
    response: r.myPartstat ? (RESPONSES[r.myPartstat.toUpperCase()] ?? null) : null,
    organizer: r.organizer ? r.organizer.replace(/^mailto:/i, '') : null,
    attendees: r.attendees,
    recurring: r.recurring,
  }
}

const startMs = (m: Meeting) => Date.parse(m.start)
const endMs = (m: Meeting) => Date.parse(m.end)

export function byStart(a: Meeting, b: Meeting): number {
  return (
    startMs(a) - startMs(b) || endMs(a) - endMs(b) || a.title.localeCompare(b.title) || (a.id < b.id ? -1 : 1)
  )
}

/**
 * Normalise a provider snapshot: convert, drop duplicates (the same invitation often lands in two
 * calendars — keep the copy where the user's own response is known), sort by start.
 */
export function toMeetings(raw: RawOccurrence[]): Meeting[] {
  const best = new Map<string, Meeting>()
  for (const r of raw) {
    const m = toMeeting(r)
    const key = `${m.uid}\n${m.recurrenceId ?? ''}\n${m.start}`
    const prev = best.get(key)
    if (!prev || (prev.response === null && m.response !== null)) best.set(key, m)
  }
  return [...best.values()].sort(byStart)
}

/** Declined and cancelled occurrences are not meetings the user is going to. */
export const attending = (m: Meeting) => m.status !== 'cancelled' && m.response !== 'declined'

/** A meeting the top bar and auto-record care about: timed, and one the user is going to. */
export const isTimedMeeting = (m: Meeting) => !m.allDay && attending(m)

/** Meetings overlapping [from, to). Zero-length meetings count if they start inside it. */
export function inWindow(ms: Meeting[], from: Date, to: Date, includeDeclined = false): Meeting[] {
  const f = from.getTime()
  const t = to.getTime()
  return ms.filter((m) => {
    if (!includeDeclined && !attending(m)) return false
    const s = startMs(m)
    const e = endMs(m)
    return e === s ? s >= f && s < t : s < t && e > f
  })
}

/** The meeting in progress (the most recently started, if they overlap), and the next one to start. */
export function currentAndNext(ms: Meeting[], now: Date): { current: Meeting | null; next: Meeting | null } {
  const n = now.getTime()
  let current: Meeting | null = null
  let next: Meeting | null = null
  for (const m of ms) {
    if (!isTimedMeeting(m)) continue
    const s = startMs(m)
    if (s <= n && endMs(m) > n) {
      if (!current || s > startMs(current) || (s === startMs(current) && byStart(m, current) < 0)) current = m
    } else if (s > n && (!next || byStart(m, next) < 0)) next = m
  }
  return { current, next }
}

/** Timed meetings in progress or starting before `until`, in progress first, capped. */
export function upcoming(ms: Meeting[], now: Date, until: Date, max: number): Meeting[] {
  return inWindow(ms, now, until)
    .filter((m) => !m.allDay)
    .slice(0, max)
}

/** End of the local day `d` falls on (i.e. the next local midnight). */
export function endOfLocalDay(d: Date, plusDays = 0): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1 + plusDays)
}

export function sessionMeeting(m: Meeting): SessionMeeting {
  return {
    id: m.id,
    uid: m.uid,
    title: m.title,
    start: m.start,
    end: m.end,
    join: m.join,
    calendar: m.calendar.name,
  }
}
