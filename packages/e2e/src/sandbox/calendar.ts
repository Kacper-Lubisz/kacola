import { createHash } from 'node:crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'

// The sandbox's mock calendar. `meetings.json` is the sandbox's own list (absolute times, who added
// each); `calendar.json` is what the daemon's file calendar provider reads (GNOMEOLA_CALENDAR=file:…),
// rendered from it after every change and replaced atomically, so the daemon (which polls the file)
// picks changes up within a second.

export const CALENDAR_ID = 'sandbox-work'
export const CALENDAR_NAME = 'Work (sandbox)'
export const ME = 'you@sandbox.test'

export type SandboxMeeting = {
  uid: string
  /** Set for an occurrence of a recurring series (its original start, UTC ISO). */
  recurrenceId: string | null
  title: string
  start: string
  end: string
  with: string[]
  url: string
  origin: 'seed' | 'user'
}

/** The daemon's meeting id for an occurrence (mirrors daemon/src/calendar/meetings.ts meetingId). */
export function meetingId(uid: string, recurrenceId: string | null, sourceUid = CALENDAR_ID): string {
  const h = createHash('sha256')
    .update(`${sourceUid}\n${uid}\n${recurrenceId ?? ''}`)
    .digest('base64url')
  return `mtg_${h.slice(0, 22)}`
}

const MIN = 60_000

/** Today's mock day, relative to `now`: three meetings coming up, and a few in the past. */
export function seedMeetings(now: number = Date.now()): SandboxMeeting[] {
  const at = (min: number) => new Date(Math.floor((now + min * MIN) / 1000) * 1000).toISOString()
  const m = (
    uid: string,
    title: string,
    startMin: number,
    lenMin: number,
    who: string[],
    url: string,
    recurring = false,
  ): SandboxMeeting => ({
    uid,
    recurrenceId: recurring ? at(startMin) : null,
    title,
    start: at(startMin),
    end: at(startMin + lenMin),
    with: who,
    url,
    origin: 'seed',
  })
  const week = 7 * 24 * 60
  return [
    // last week's 1:1 (the same series: what Plan with Claude and carry-over read), and two past meetings
    m(
      'sandbox-ana-1on1@kacola.test',
      '1:1 with Ana',
      2 - week,
      12,
      ['Ana Ruiz <ana@sandbox.test>'],
      'https://meet.google.com/kac-olas-ana',
      true,
    ),
    m(
      'sandbox-design-review@kacola.test',
      'Design review: checkout flow',
      -26 * 60,
      45,
      ['Ben Okafor <ben@sandbox.test>', 'Priya Shah <priya@sandbox.test>'],
      'https://meet.google.com/kac-olas-dsn',
    ),
    m(
      'sandbox-hiring-sync@kacola.test',
      'Hiring sync',
      -3 * 24 * 60,
      30,
      ['Lena Fischer <lena@sandbox.test>'],
      'https://us02web.zoom.us/j/81234567001',
    ),
    // today
    m(
      'sandbox-ana-1on1@kacola.test',
      '1:1 with Ana',
      2,
      12,
      ['Ana Ruiz <ana@sandbox.test>'],
      'https://meet.google.com/kac-olas-ana',
      true,
    ),
    m(
      'sandbox-sam-intro@kacola.test',
      'Intro call with Sam',
      15,
      20,
      ['Sam Lee <sam@example.org>'],
      'https://us02web.zoom.us/j/81234567890?pwd=sandbox',
    ),
    m(
      'sandbox-pm-feedback@kacola.test',
      'Prototype feedback with the PM',
      40,
      30,
      ['Priya Shah <priya@sandbox.test>'],
      'https://meet.google.com/kac-olas-pmf',
    ),
  ]
}

export function readMeetings(file: string): SandboxMeeting[] {
  if (!existsSync(file)) return []
  return (JSON.parse(readFileSync(file, 'utf8')) as { meetings: SandboxMeeting[] }).meetings
}

/** The file calendar provider's format (daemon/src/calendar/providers.ts CalendarFile). */
export function renderCalendar(meetings: SandboxMeeting[]): string {
  return JSON.stringify(
    {
      calendars: [{ id: CALENDAR_ID, name: CALENDAR_NAME }],
      occurrences: meetings.map((m) => ({
        sourceUid: CALENDAR_ID,
        calendarName: CALENDAR_NAME,
        uid: m.uid,
        recurrenceId: m.recurrenceId,
        summary: m.title,
        description: m.with.length ? `With ${m.with.join(', ')}` : '',
        location: '',
        url: m.url,
        start: m.start,
        end: m.end,
        allDay: false,
        startDate: null,
        endDate: null,
        timezone: null,
        status: 'CONFIRMED',
        myPartstat: null,
        organizer: `mailto:${ME}`,
        attendees: m.with.length + 1,
        recurring: m.recurrenceId !== null,
        xprops: {},
      })),
    },
    null,
    2,
  )
}

const atomic = (file: string, text: string) => {
  writeFileSync(`${file}.tmp`, text)
  renameSync(`${file}.tmp`, file)
}

export function writeMeetings(
  files: { meetings: string; calendar: string },
  meetings: SandboxMeeting[],
): void {
  const sorted = [...meetings].sort((a, b) => a.start.localeCompare(b.start))
  atomic(files.meetings, `${JSON.stringify({ meetings: sorted }, null, 2)}\n`)
  atomic(files.calendar, renderCalendar(sorted))
}

/** `5m`, `90s`, `1h30m`, `2h` → ms. Negative with a leading `-` (a meeting already under way). */
export function parseDuration(s: string): number {
  const m = /^(-)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(s.trim())
  if (!m || (!m[2] && !m[3] && !m[4])) throw new Error(`not a duration: ${JSON.stringify(s)} (try 5m, 1h30m)`)
  const ms = (Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)) * MIN + Number(m[4] ?? 0) * 1000
  return m[1] ? -ms : ms
}

/** "in 3 min", "12 min ago", "now". */
export function relative(iso: string, now = Date.now()): string {
  const d = Math.round((Date.parse(iso) - now) / MIN)
  if (d === 0) return 'now'
  const abs = Math.abs(d)
  const span =
    abs >= 2 * 24 * 60
      ? `${Math.round(abs / 1440)} days`
      : abs >= 120
        ? `${Math.round(abs / 60)} h`
        : `${abs} min`
  return d > 0 ? `in ${span}` : `${span} ago`
}
