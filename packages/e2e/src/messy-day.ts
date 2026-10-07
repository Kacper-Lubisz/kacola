import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Store } from '@kacola/store'

// A messy, real-world day for home (invented content, real shapes): what a person with ten calendars
// through Evolution Data Server actually has. Thursday 1 October 2026, in Europe/London (BST, UTC+1):
//
//   all day       a multi-day conference week, a one-day offsite prep, (tomorrow's bank holiday)
//   overnight     a release window that began at 23:30 last night
//   08:00         gym (personal calendar, no link, nobody invited)
//   09:00         the daily standup (recurring, Meet) — recorded, linked
//   09:00–10:00   quarterly planning with a very long title, overlapping the standup, 14 people, Zoom
//   10:30         a vendor pitch I declined (hidden)
//   11:00         design sync, cancelled (hidden)
//   11:00–12:00   architecture review, the same invitation in three calendars (one row)
//   12:30         lunch (no link)
//   13:00         1:1 with Priya, tentative, Teams — in progress at the fixture's "now" (13:10)
//   14:00         customer onboarding with a long title, Meet; 14:00–14:45 an overlapping interview
//   15:00         team retro, not answered yet, Jitsi
//   16:00         focus time
//   17:30         product demo, Webex
//   23:30         an on-call handover running past midnight
//
// Plus recordings: three accidental few-second ones and an untitled 38-minute call this morning, all
// with the store's stand-in "Meeting <UTC time>" titles; yesterday's and Monday's recordings. Friday
// has the bank holiday; Saturday is empty. Nothing here is anyone's real calendar.

export const MESSY_TZ = 'Europe/London'
/** A wall-clock time on the fixture's days, in BST (UTC+1). `day` 0 = Thursday 1 October 2026. */
export const bst = (h: number, m = 0, day = 0) => Date.UTC(2026, 9, 1 + day, h - 1, m)
const iso = (t: number) => new Date(t).toISOString()

/** The renderer's "now" for the main shot: 13:10, the 1:1 under way. */
export const MESSY_NOW = bst(13, 10)
/** Late afternoon, nothing under way: the demo expanded above the now line, focus time below it. */
export const MESSY_AFTERNOON = bst(17, 15)
/** Saturday: nothing on the calendar; Thursday's recordings below. */
export const MESSY_EMPTY_DAY = bst(10, 0, 2)

type Occ = Record<string, unknown>
const occ = (o: {
  uid: string
  summary: string
  start: number
  minutes: number
  cal?: [string, string]
  url?: string
  location?: string
  partstat?: string | null
  status?: string
  attendees?: number
  recurring?: boolean
}): Occ => ({
  sourceUid: (o.cal ?? ['cal-work', 'Work'])[0],
  calendarName: (o.cal ?? ['cal-work', 'Work'])[1],
  uid: o.uid,
  recurrenceId: o.recurring ? iso(o.start) : null,
  summary: o.summary,
  description: '',
  location: o.location ?? '',
  url: o.url ?? '',
  start: iso(o.start),
  end: iso(o.start + o.minutes * 60_000),
  allDay: false,
  startDate: null,
  endDate: null,
  timezone: 'Europe/London',
  status: o.status ?? 'CONFIRMED',
  myPartstat: o.partstat === undefined ? 'ACCEPTED' : o.partstat,
  organizer: 'mailto:organiser@example.com',
  attendees: o.attendees ?? 3,
  recurring: o.recurring ?? false,
  xprops: {},
})
const allDay = (uid: string, summary: string, startDate: string, endDate: string, cal: [string, string]) => ({
  ...occ({ uid, summary, start: bst(0), minutes: 0, cal, partstat: null, attendees: 0 }),
  allDay: true,
  startDate,
  endDate,
  timezone: null,
})

const PERSONAL: [string, string] = ['cal-personal', 'Personal']
const TEAM: [string, string] = ['cal-team', 'Team']
const HOLIDAYS: [string, string] = ['cal-holidays', 'Holidays']

export const MESSY_TITLES = {
  standup: 'Daily standup',
  planning: 'Quarterly planning: roadmap, hiring plan, budget and the platform migration timeline for Q1',
  review: 'Architecture review',
  priya: '1:1 with Priya',
  onboarding: 'Customer onboarding: Northwind Traders EMEA follow-up on SSO migration and billing',
  interview: 'Interview: backend engineer',
  retro: 'Team retro',
  demo: 'Product demo',
}

export function messyCalendar(): { calendars: { id: string; name: string }[]; occurrences: Occ[] } {
  const meet = (code: string) => `https://meet.google.com/${code}`
  const occurrences: Occ[] = [
    allDay('conf@x', 'Platform conference week', '2026-09-28', '2026-10-03', TEAM),
    allDay('offsite@x', 'Offsite prep', '2026-10-01', '2026-10-02', PERSONAL),
    allDay('bank@x', 'Bank holiday', '2026-10-02', '2026-10-03', HOLIDAYS),
    occ({ uid: 'release@x', summary: 'Release window', start: bst(23, 30, -1), minutes: 120, cal: TEAM }),
    occ({
      uid: 'gym@x',
      summary: 'Gym',
      start: bst(8),
      minutes: 45,
      cal: PERSONAL,
      partstat: null,
      attendees: 0,
    }),
    occ({
      uid: 'standup@x',
      summary: MESSY_TITLES.standup,
      start: bst(9),
      minutes: 15,
      url: meet('abc-defg-hij'),
      recurring: true,
      attendees: 6,
    }),
    occ({
      uid: 'planning@x',
      summary: MESSY_TITLES.planning,
      start: bst(9),
      minutes: 60,
      location: 'https://zoom.us/j/5550001111',
      attendees: 14,
    }),
    occ({ uid: 'vendor@x', summary: 'Vendor pitch', start: bst(10, 30), minutes: 30, partstat: 'DECLINED' }),
    occ({ uid: 'design@x', summary: 'Design sync', start: bst(11), minutes: 30, status: 'CANCELLED' }),
    // the same invitation, copied into three calendars under different UIDs (seen on a real machine)
    occ({
      uid: 'arch-a@x',
      summary: MESSY_TITLES.review,
      start: bst(11),
      minutes: 60,
      cal: TEAM,
      partstat: null,
    }),
    occ({
      uid: 'arch-b@x',
      summary: MESSY_TITLES.review,
      start: bst(11),
      minutes: 60,
      url: meet('arc-hrev-iew'),
    }),
    occ({
      uid: 'arch-c@x',
      summary: MESSY_TITLES.review,
      start: bst(11),
      minutes: 60,
      cal: PERSONAL,
      partstat: 'NEEDS-ACTION',
    }),
    occ({
      uid: 'lunch@x',
      summary: 'Lunch',
      start: bst(12, 30),
      minutes: 60,
      cal: PERSONAL,
      attendees: 0,
      partstat: null,
    }),
    occ({
      uid: 'priya@x',
      summary: MESSY_TITLES.priya,
      start: bst(13),
      minutes: 30,
      location: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_x',
      partstat: 'TENTATIVE',
      attendees: 2,
      recurring: true,
    }),
    occ({
      uid: 'onboarding@x',
      summary: MESSY_TITLES.onboarding,
      start: bst(14),
      minutes: 30,
      url: meet('nor-thwi-nds'),
    }),
    occ({ uid: 'interview@x', summary: MESSY_TITLES.interview, start: bst(14), minutes: 45, attendees: 4 }),
    occ({
      uid: 'retro@x',
      summary: MESSY_TITLES.retro,
      start: bst(15),
      minutes: 25,
      location: 'https://meet.jit.si/team-retro-room',
      partstat: 'NEEDS-ACTION',
    }),
    occ({ uid: 'focus@x', summary: 'Focus time', start: bst(16), minutes: 60, partstat: null, attendees: 0 }),
    occ({
      uid: 'demo@x',
      summary: MESSY_TITLES.demo,
      start: bst(17, 30),
      minutes: 30,
      location: 'https://acme.webex.com/meet/demo',
    }),
    occ({ uid: 'oncall@x', summary: 'On-call handover', start: bst(23, 30), minutes: 60, cal: TEAM }),
  ]
  return {
    calendars: [
      { id: 'cal-work', name: 'Work' },
      { id: 'cal-team', name: 'Team' },
      { id: 'cal-personal', name: 'Personal' },
      { id: 'cal-holidays', name: 'Holidays' },
    ],
    occurrences,
  }
}

/** Write the calendar file (and, with `offline`, the calendars to report as not up to date). */
export function writeMessyCalendar(
  file: string,
  offline?: { id: string; name: string; reason: string }[],
): void {
  writeFileSync(file, JSON.stringify({ ...messyCalendar(), ...(offline ? { offline } : {}) }))
}

export const MESSY_SESSIONS = {
  standup: 'ses_00000000m1aaaaaaaaaa1',
  blip1: 'ses_00000000m2bbbbbbbbbb2',
  blip2: 'ses_00000000m3cccccccccc3',
  blip3: 'ses_00000000m4dddddddddd4',
  untitled: 'ses_00000000m5eeeeeeeeee5',
  yesterday: 'ses_00000000m6ffffffffff6',
  monday: 'ses_00000000m7gggggggggg7',
}

/** An occurrence's id as the daemon computes it (packages/daemon/src/calendar/meetings.ts meetingId). */
const meetingId = (sourceUid: string, uid: string, recurrenceId: string | null) =>
  `mtg_${createHash('sha256')
    .update(`${sourceUid}\n${uid}\n${recurrenceId ?? ''}`)
    .digest('base64url')
    .slice(0, 22)}`

/** Seed the recordings into a data dir, before the daemon starts on it. */
export function seedMessySessions(dataDir: string): void {
  const standupMeetingId = meetingId('cal-work', 'standup@x', iso(bst(9)))
  // the store's clock set to each recording's start, so createdAt and the stand-in title are what the
  // store itself would have made then
  let clock = 0
  const store = Store.open(join(dataDir, 'kacola.db'), { now: () => new Date(clock) })
  const rec = (
    id: string,
    t: number,
    durationMs: number,
    o: { title?: string; meeting?: Record<string, unknown> } = {},
  ) => {
    clock = t
    store.createSession({ id, ...(o.title ? { title: o.title } : {}), private: false })
    store.updateSession(id, (s) => ({
      ...s,
      startedAt: iso(t),
      endedAt: iso(t + durationMs),
      status: 'stopped',
      durationMs,
      ...(o.meeting ? { meeting: o.meeting as never } : {}),
    }))
  }
  rec(MESSY_SESSIONS.standup, bst(9, 1), 14 * 60_000, {
    title: MESSY_TITLES.standup,
    meeting: {
      id: standupMeetingId,
      uid: 'standup@x',
      title: MESSY_TITLES.standup,
      start: iso(bst(9)),
      end: iso(bst(9, 15)),
      join: { url: 'https://meet.google.com/abc-defg-hij', provider: 'meet' },
      calendar: 'Work',
    },
  })
  rec(MESSY_SESSIONS.blip1, bst(10, 12, 0) + 4_000, 2_000)
  rec(MESSY_SESSIONS.blip2, bst(10, 12, 0) + 31_000, 3_000)
  rec(MESSY_SESSIONS.blip3, bst(10, 13, 0) + 2_000, 5_000)
  rec(MESSY_SESSIONS.untitled, bst(10, 20), 38 * 60_000)
  rec(MESSY_SESSIONS.yesterday, bst(16, 2, -1), 38 * 60_000)
  rec(MESSY_SESSIONS.monday, bst(12, 0, -3), 46 * 60_000, { title: 'Hiring panel debrief' })
  store.close()
}
