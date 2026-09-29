// V-4c calendar fixtures: a seeded set of calendars whose every occurrence in WINDOW is known exactly.
// Written as the iCalendar a real server would hand EDS (Google, Exchange, Zoom invites), including the
// shapes that break naive readers: a weekly series crossing the European DST end, a US series crossing
// the US one, floating time, DATE-valued all-day events (with and without DTEND), EXDATE, a moved and a
// cancelled detached instance, COUNT/UNTIL, declined/tentative/unanswered invitations, a disabled
// calendar, and every common join-link carrier (LOCATION, DESCRIPTION incl. HTML, URL, X- properties).
//
// The agent is run with TZ=FIXTURE_TZ so floating times and all-day dates resolve deterministically.

export const FIXTURE_TZ = 'Europe/Warsaw'
export const ME = 'me@example.com'
export const WINDOW = { from: '2026-10-01T00:00:00.000Z', to: '2026-11-15T00:00:00.000Z' }

export type FixtureCalendar = {
  uid: string
  name: string
  enabled: boolean
  /** VEVENT (and VTIMEZONE) blocks, without the VCALENDAR wrapper. */
  components: string[]
}

export type ExpectedOccurrence = {
  sourceUid: string
  uid: string
  recurrenceId: string | null
  summary: string
  /** Timed: UTC instants. All-day: null (see startDate/endDate). */
  start: string | null
  end: string | null
  allDay: boolean
  startDate: string | null
  endDate: string | null
  timezone: string | null
  status: string
  myPartstat: string | null
  attendees: number
  recurring: boolean
  /** Checked when present. */
  location?: string
  description?: string
  url?: string
  xprops?: Record<string, string>
  organizer?: string | null
}

const WARSAW_VTIMEZONE = `BEGIN:VTIMEZONE
TZID:Europe/Warsaw
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`

const ev = (lines: string[]) =>
  ['BEGIN:VEVENT', 'DTSTAMP:20260901T000000Z', ...lines, 'END:VEVENT'].join('\n')

export const LINKS = {
  meet: 'https://meet.google.com/abc-defg-hij',
  zoomHtml:
    '<p>Join Zoom Meeting<br><a href="https://acme.zoom.us/j/81234567890?pwd=AbC123&amp;from=addon">https://acme.zoom.us/j/81234567890?pwd=AbC123&amp;from=addon</a></p>',
  teamsDescription:
    'Microsoft Teams meeting\\nJoin on your computer\\, mobile app or room device\\nJoin the meeting now<https://teams.microsoft.com/l/meetup-join/19%3ameeting_NzQ5ZTk%40thread.v2/0?context=%7b%22Tid%22%3a%22t1%22%2c%22Oid%22%3a%22o1%22%7d>\\nMeeting ID: 123 456 789',
  teamsUrl:
    'https://teams.microsoft.com/l/meetup-join/19%3ameeting_NzQ5ZTk%40thread.v2/0?context=%7b%22Tid%22%3a%22t1%22%2c%22Oid%22%3a%22o1%22%7d',
  googleConference: 'https://meet.google.com/xyz-abcd-efg',
  webex: 'https://acme.webex.com/acme/j.php?MTID=m1234567890abcdef',
}

export const CALENDARS: FixtureCalendar[] = [
  {
    uid: 'gnomeola-work',
    name: 'Work',
    enabled: true,
    components: [
      WARSAW_VTIMEZONE,
      // Weekly across the EU DST end (2026-10-25): 09:00 Warsaw is 07:00Z before, 08:00Z after.
      ev([
        'UID:standup-warsaw@test',
        'SUMMARY:Platform standup',
        'DTSTART;TZID=Europe/Warsaw:20261019T090000',
        'DTEND;TZID=Europe/Warsaw:20261019T093000',
        'RRULE:FREQ=WEEKLY;COUNT=4',
        `LOCATION:${LINKS.meet}`,
      ]),
      // Weekly across the US DST end (2026-11-01), no VTIMEZONE (libical's builtin zone), UNTIL-bounded.
      ev([
        'UID:ny-sync@test',
        'SUMMARY:NY sync',
        'DTSTART;TZID=America/New_York:20261029T100000',
        'DTEND;TZID=America/New_York:20261029T103000',
        'RRULE:FREQ=WEEKLY;UNTIL=20261106T000000Z',
        `DESCRIPTION:${LINKS.zoomHtml}`,
      ]),
      ev([
        'UID:utc-review@test',
        'SUMMARY:Design review',
        'DTSTART:20261015T130000Z',
        'DTEND:20261015T140000Z',
        `DESCRIPTION:${LINKS.teamsDescription}`,
        `X-MICROSOFT-SKYPETEAMSMEETINGURL:${LINKS.teamsUrl}`,
      ]),
      // Floating: 12:00 wherever the user is (Warsaw, CEST → 10:00Z).
      ev(['UID:floating-lunch@test', 'SUMMARY:Lunch', 'DTSTART:20261016T120000', 'DTEND:20261016T130000']),
      ev([
        'UID:allday-offsite@test',
        'SUMMARY:Offsite',
        'DTSTART;VALUE=DATE:20261020',
        'DTEND;VALUE=DATE:20261021',
      ]),
      ev([
        'UID:allday-conf@test',
        'SUMMARY:Conference',
        'DTSTART;VALUE=DATE:20261102',
        'DTEND;VALUE=DATE:20261105',
      ]),
      ev(['UID:allday-nodtend@test', 'SUMMARY:Holiday', 'DTSTART;VALUE=DATE:20261110']),
      ev([
        'UID:declined@test',
        'SUMMARY:Vendor pitch',
        'DTSTART:20261021T100000Z',
        'DTEND:20261021T110000Z',
        'ORGANIZER;CN=Boss:mailto:boss@example.com',
        'ATTENDEE;CN=Boss;PARTSTAT=ACCEPTED:mailto:boss@example.com',
        'ATTENDEE;CN=Me;PARTSTAT=DECLINED:mailto:ME@Example.com',
      ]),
      ev([
        'UID:tentative@test',
        'SUMMARY:Maybe sync',
        'DTSTART:20261021T120000Z',
        'DTEND:20261021T123000Z',
        'ORGANIZER:mailto:boss@example.com',
        'ATTENDEE;PARTSTAT=TENTATIVE:mailto:me@example.com',
      ]),
      ev([
        'UID:needs-action@test',
        'SUMMARY:Unanswered',
        'DTSTART:20261021T140000Z',
        'DTEND:20261021T143000Z',
        'ORGANIZER:mailto:boss@example.com',
        'ATTENDEE;RSVP=TRUE:mailto:me@example.com',
        'ATTENDEE:mailto:other@example.com',
      ]),
      // Daily ×3 whose middle instance was cancelled by the organizer.
      ev([
        'UID:daily-cancel@test',
        'SUMMARY:Daily ops',
        'DTSTART:20261022T150000Z',
        'DTEND:20261022T151500Z',
        'RRULE:FREQ=DAILY;COUNT=3',
      ]),
      ev([
        'UID:daily-cancel@test',
        'RECURRENCE-ID:20261023T150000Z',
        'SUMMARY:Daily ops',
        'STATUS:CANCELLED',
        'DTSTART:20261023T150000Z',
        'DTEND:20261023T151500Z',
      ]),
      ev([
        'UID:exdate@test',
        'SUMMARY:Weekly 1:1',
        'DTSTART:20261006T080000Z',
        'DTEND:20261006T083000Z',
        'RRULE:FREQ=WEEKLY;COUNT=3',
        'EXDATE:20261013T080000Z',
      ]),
      // Daily ×3; the second one moved from 10:00Z to 14:00Z and renamed.
      ev([
        'UID:moved@test',
        'SUMMARY:Sync',
        'DTSTART:20261007T100000Z',
        'DTEND:20261007T103000Z',
        'RRULE:FREQ=DAILY;COUNT=3',
      ]),
      ev([
        'UID:moved@test',
        'RECURRENCE-ID:20261008T100000Z',
        'SUMMARY:Moved sync',
        'DTSTART:20261008T140000Z',
        'DTEND:20261008T143000Z',
      ]),
      ev([
        'UID:google-conf@test',
        'SUMMARY:Google call',
        'DTSTART:20261024T090000Z',
        'DTEND:20261024T100000Z',
        `X-GOOGLE-CONFERENCE:${LINKS.googleConference}`,
      ]),
      ev([
        'UID:webex@test',
        'SUMMARY:Webex call',
        'DTSTART:20261027T160000Z',
        'DTEND:20261027T170000Z',
        `URL:${LINKS.webex}`,
      ]),
      ev(['UID:outside@test', 'SUMMARY:Long ago', 'DTSTART:20260901T100000Z', 'DTEND:20260901T110000Z']),
    ],
  },
  {
    uid: 'gnomeola-personal',
    name: 'Personal things',
    enabled: true,
    components: [
      ev(['UID:dentist@test', 'SUMMARY:Dentist', 'DTSTART:20261028T070000Z', 'DTEND:20261028T080000Z']),
    ],
  },
  {
    uid: 'gnomeola-disabled',
    name: 'Disabled',
    enabled: false,
    components: [
      ev(['UID:hidden@test', 'SUMMARY:Hidden', 'DTSTART:20261015T090000Z', 'DTEND:20261015T100000Z']),
    ],
  },
]

const W = 'gnomeola-work'
const base = {
  sourceUid: W,
  allDay: false,
  startDate: null,
  endDate: null,
  timezone: null,
  status: '',
  myPartstat: null,
  attendees: 0,
  recurring: false,
  recurrenceId: null,
}
const timed = (
  uid: string,
  summary: string,
  start: string,
  end: string,
  o: Partial<ExpectedOccurrence> = {},
) => ({ ...base, uid, summary, start, end, ...o }) as ExpectedOccurrence
const series = (
  uid: string,
  summary: string,
  start: string,
  end: string,
  o: Partial<ExpectedOccurrence> = {},
) => timed(uid, summary, start, end, { recurring: true, recurrenceId: start, ...o })
const allDay = (uid: string, summary: string, startDate: string, endDate: string) =>
  ({ ...base, uid, summary, start: null, end: null, allDay: true, startDate, endDate }) as ExpectedOccurrence

const z = (s: string) => `${s}.000Z`

/** Every occurrence the agent must report for WINDOW, sorted by start then uid (all-day by local midnight). */
export const EXPECTED: ExpectedOccurrence[] = [
  series('exdate@test', 'Weekly 1:1', z('2026-10-06T08:00:00'), z('2026-10-06T08:30:00')),
  series('moved@test', 'Sync', z('2026-10-07T10:00:00'), z('2026-10-07T10:30:00')),
  series('moved@test', 'Moved sync', z('2026-10-08T14:00:00'), z('2026-10-08T14:30:00'), {
    recurrenceId: z('2026-10-08T10:00:00'),
  }),
  series('moved@test', 'Sync', z('2026-10-09T10:00:00'), z('2026-10-09T10:30:00')),
  timed('utc-review@test', 'Design review', z('2026-10-15T13:00:00'), z('2026-10-15T14:00:00'), {
    xprops: { 'X-MICROSOFT-SKYPETEAMSMEETINGURL': LINKS.teamsUrl },
  }),
  timed('floating-lunch@test', 'Lunch', z('2026-10-16T10:00:00'), z('2026-10-16T11:00:00')),
  series('standup-warsaw@test', 'Platform standup', z('2026-10-19T07:00:00'), z('2026-10-19T07:30:00'), {
    timezone: 'Europe/Warsaw',
    location: LINKS.meet,
  }),
  allDay('allday-offsite@test', 'Offsite', '2026-10-20', '2026-10-21'),
  series('exdate@test', 'Weekly 1:1', z('2026-10-20T08:00:00'), z('2026-10-20T08:30:00')),
  timed('declined@test', 'Vendor pitch', z('2026-10-21T10:00:00'), z('2026-10-21T11:00:00'), {
    myPartstat: 'DECLINED',
    attendees: 2,
    organizer: 'boss@example.com',
  }),
  timed('tentative@test', 'Maybe sync', z('2026-10-21T12:00:00'), z('2026-10-21T12:30:00'), {
    myPartstat: 'TENTATIVE',
    attendees: 1,
  }),
  timed('needs-action@test', 'Unanswered', z('2026-10-21T14:00:00'), z('2026-10-21T14:30:00'), {
    myPartstat: 'NEEDS-ACTION',
    attendees: 2,
  }),
  series('daily-cancel@test', 'Daily ops', z('2026-10-22T15:00:00'), z('2026-10-22T15:15:00')),
  series('daily-cancel@test', 'Daily ops', z('2026-10-23T15:00:00'), z('2026-10-23T15:15:00'), {
    status: 'CANCELLED',
  }),
  timed('google-conf@test', 'Google call', z('2026-10-24T09:00:00'), z('2026-10-24T10:00:00'), {
    xprops: { 'X-GOOGLE-CONFERENCE': LINKS.googleConference },
  }),
  series('daily-cancel@test', 'Daily ops', z('2026-10-24T15:00:00'), z('2026-10-24T15:15:00')),
  // after the EU DST end: same wall-clock time, one hour later in UTC
  series('standup-warsaw@test', 'Platform standup', z('2026-10-26T08:00:00'), z('2026-10-26T08:30:00'), {
    timezone: 'Europe/Warsaw',
  }),
  timed('webex@test', 'Webex call', z('2026-10-27T16:00:00'), z('2026-10-27T17:00:00'), { url: LINKS.webex }),
  timed('dentist@test', 'Dentist', z('2026-10-28T07:00:00'), z('2026-10-28T08:00:00'), {
    sourceUid: 'gnomeola-personal',
  }),
  // before the US DST end: 10:00 EDT = 14:00Z
  series('ny-sync@test', 'NY sync', z('2026-10-29T14:00:00'), z('2026-10-29T14:30:00'), {
    timezone: 'America/New_York',
  }),
  allDay('allday-conf@test', 'Conference', '2026-11-02', '2026-11-05'),
  series('standup-warsaw@test', 'Platform standup', z('2026-11-02T08:00:00'), z('2026-11-02T08:30:00'), {
    timezone: 'Europe/Warsaw',
  }),
  // after the US DST end: 10:00 EST = 15:00Z
  series('ny-sync@test', 'NY sync', z('2026-11-05T15:00:00'), z('2026-11-05T15:30:00'), {
    timezone: 'America/New_York',
  }),
  series('standup-warsaw@test', 'Platform standup', z('2026-11-09T08:00:00'), z('2026-11-09T08:30:00'), {
    timezone: 'Europe/Warsaw',
  }),
  allDay('allday-nodtend@test', 'Holiday', '2026-11-10', '2026-11-11'),
]

/** A calendar file body for EDS's local backend. */
export function toIcs(components: string[]): string {
  const body = [
    'BEGIN:VCALENDAR',
    'PRODID:-//gnomeola//testkit//EN',
    'VERSION:2.0',
    ...components,
    'END:VCALENDAR',
  ]
  return `${body.join('\r\n').replace(/\r?\n/g, '\r\n')}\r\n`
}

// ------------------------------------------------------------------------------------ relative to now
//
// For tests of "what is on now / next" through the daemon, whose answers depend on the wall clock: a
// calendar whose events sit around `now`. All instants are whole minutes.

export type LiveFixture = {
  calendar: FixtureCalendar
  /** uid → the absolute times it was seeded with. */
  times: Record<string, { start: string; end: string }>
  /** The local date (in `tz`) of the all-day event: today. */
  today: string
}

const icsUtc = (d: Date) => `${d.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`

export function liveFixture(now: Date = new Date(), tz: string = FIXTURE_TZ): LiveFixture {
  const minute = 60_000
  const baseMs = Math.floor(now.getTime() / minute) * minute
  const at = (min: number) => new Date(baseMs + min * minute)
  const times: LiveFixture['times'] = {}
  const timedEv = (uid: string, fromMin: number, toMin: number, lines: string[]) => {
    times[uid] = { start: at(fromMin).toISOString(), end: at(toMin).toISOString() }
    return ev([`UID:${uid}`, `DTSTART:${icsUtc(at(fromMin))}`, `DTEND:${icsUtc(at(toMin))}`, ...lines])
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now) // YYYY-MM-DD
  const next = new Date(`${today}T12:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  const compact = (s: string) => s.replaceAll('-', '')
  return {
    today,
    times,
    calendar: {
      uid: 'gnomeola-live',
      name: 'Live',
      enabled: true,
      components: [
        timedEv('live-current@test', -10, 20, ['SUMMARY:Current Zoom', `DESCRIPTION:${LINKS.zoomHtml}`]),
        timedEv('live-declined@test', 15, 45, [
          'SUMMARY:Declined soon',
          'ORGANIZER:mailto:boss@example.com',
          'ATTENDEE;PARTSTAT=DECLINED:mailto:me@example.com',
          `LOCATION:${LINKS.meet}`,
        ]),
        timedEv('live-next@test', 30, 60, ['SUMMARY:Next Meet', `LOCATION:${LINKS.meet}`]),
        timedEv('live-later@test', 180, 210, [
          'SUMMARY:Later Teams',
          `DESCRIPTION:${LINKS.teamsDescription}`,
        ]),
        ev([
          'UID:live-allday@test',
          'SUMMARY:All day today',
          `DTSTART;VALUE=DATE:${compact(today)}`,
          `DTEND;VALUE=DATE:${compact(next.toISOString().slice(0, 10))}`,
        ]),
      ],
    },
  }
}
