import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { CalendarState } from '@kacola/protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RawOccurrence } from '../src/calendar/agent-protocol.ts'
import { expandIcs, IcsCalendarProvider, ianaZone, icsSourceUid } from '../src/calendar/ics.ts'
import { toMeetings } from '../src/calendar/meetings.ts'
import type { CalendarSnapshot, ProviderListener } from '../src/calendar/providers.ts'
import type { Logger } from '../src/logger.ts'

const FIX = resolve(import.meta.dirname, 'fixtures/ics')
const fixture = (name: string) => readFileSync(join(FIX, name), 'utf8')
const d = (iso: string) => new Date(iso)
const OCT = d('2026-10-01T00:00:00Z')
const DEC = d('2026-12-01T00:00:00Z')
const ME = ['kacper@example.com']

/** The instant a floating (local wall-clock) time names — the rule the provider applies. */
const local = (y: number, mo: number, day: number, h: number, mi = 0) =>
  new Date(y, mo - 1, day, h, mi).toISOString()

const byUid = (s: CalendarSnapshot, uid: string) => s.occurrences.filter((o) => o.uid === uid)
const starts = (os: RawOccurrence[]) => os.map((o) => o.start)

function cal(...events: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...events, 'END:VCALENDAR'].join('\r\n')
}
function vevent(lines: Record<string, string> | string[]): string {
  const body = Array.isArray(lines) ? lines : Object.entries(lines).map(([k, v]) => `${k}:${v}`)
  return ['BEGIN:VEVENT', ...body, 'END:VEVENT'].join('\r\n')
}

function stubLogger() {
  const warn = vi.fn()
  const logger = { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() } as unknown as Logger
  return { logger, warn }
}

describe('expandIcs — Google export with VTIMEZONE', () => {
  const snap = expandIcs(fixture('google-warsaw.ics'), OCT, DEC, { sourceUid: 'ics:test', me: ME })

  it('produces schema-valid occurrences and names the calendar from X-WR-CALNAME', () => {
    for (const o of snap.occurrences) expect(RawOccurrence.safeParse(o).success).toBe(true)
    expect(snap.calendars).toEqual([{ id: 'ics:test', name: 'Work' }])
    expect(new Set(snap.occurrences.map((o) => o.calendarName))).toEqual(new Set(['Work']))
    // sorted by start
    expect(starts(snap.occurrences)).toEqual([...starts(snap.occurrences)].sort())
  })

  it('expands the weekly standup across the EU DST change, with EXDATE, a moved and a cancelled instance', () => {
    const s = byUid(snap, 'standup-7f3a@google.com')
    expect(s.map((o) => [o.start, o.end, o.recurrenceId, o.status, o.summary])).toEqual([
      [
        '2026-10-12T07:30:00.000Z',
        '2026-10-12T07:45:00.000Z',
        '2026-10-12T07:30:00.000Z',
        'CONFIRMED',
        'Team standup',
      ],
      [
        '2026-10-19T07:30:00.000Z',
        '2026-10-19T07:45:00.000Z',
        '2026-10-19T07:30:00.000Z',
        'CONFIRMED',
        'Team standup',
      ],
      // 25 Oct: CEST → CET, so 09:30 local is an hour later in UTC
      [
        '2026-10-26T08:30:00.000Z',
        '2026-10-26T08:45:00.000Z',
        '2026-10-26T08:30:00.000Z',
        'CONFIRMED',
        'Team standup',
      ],
      // 2 Nov: EXDATE
      // 9 Nov: moved to Tuesday 14:00
      [
        '2026-11-10T13:00:00.000Z',
        '2026-11-10T13:15:00.000Z',
        '2026-11-09T08:30:00.000Z',
        'CONFIRMED',
        'Team standup (moved)',
      ],
      [
        '2026-11-16T08:30:00.000Z',
        '2026-11-16T08:45:00.000Z',
        '2026-11-16T08:30:00.000Z',
        'CANCELLED',
        'Team standup',
      ],
      [
        '2026-11-23T08:30:00.000Z',
        '2026-11-23T08:45:00.000Z',
        '2026-11-23T08:30:00.000Z',
        'CONFIRMED',
        'Team standup',
      ],
      [
        '2026-11-30T08:30:00.000Z',
        '2026-11-30T08:45:00.000Z',
        '2026-11-30T08:30:00.000Z',
        'CONFIRMED',
        'Team standup',
      ],
    ])
    for (const o of s) {
      expect(o.recurring).toBe(true)
      expect(o.timezone).toBe('Europe/Warsaw')
      expect(o.allDay).toBe(false)
    }
    const first = s[0]
    expect(first).toMatchObject({
      myPartstat: 'ACCEPTED',
      attendees: 3,
      organizer: 'ana@example.com',
      xprops: { 'X-GOOGLE-CONFERENCE': 'https://meet.google.com/std-upxx-abc' },
    })
    expect(first?.description).toBe(
      'Daily-ish standup, weekly on Mondays.\nJoin with Google Meet: https://meet.google.com/std-upxx-abc',
    )
    // the override carries its own attendees and response
    expect(s[3]).toMatchObject({ myPartstat: 'TENTATIVE', attendees: 2 })
  })

  it('reads the user response case-insensitively; declined and cancelled drop out of meetings', () => {
    expect(byUid(snap, 'roadmap-91bd@google.com')[0]).toMatchObject({
      myPartstat: 'DECLINED',
      organizer: 'carol@partner.example',
      attendees: 2,
      recurring: false,
      recurrenceId: null,
      timezone: null,
    })
    const meetings = toMeetings(snap.occurrences)
    expect(meetings.find((m) => m.uid === 'roadmap-91bd@google.com')?.response).toBe('declined')
    expect(meetings.filter((m) => m.status === 'cancelled')).toHaveLength(1)
  })

  it('keeps the Meet link, URL and LOCATION of a one-off meeting', () => {
    const [o] = byUid(snap, 'design-sync-44c1@google.com')
    expect(o).toMatchObject({
      start: '2026-10-22T14:00:00.000Z',
      end: '2026-10-22T14:30:00.000Z',
      location: 'Room 4.12, Warsaw office',
      description: 'Agenda: tokens, spacing.',
      url: 'https://calendar.google.com/calendar/event?eid=ZGVzaWdu',
      xprops: { 'X-GOOGLE-CONFERENCE': 'https://meet.google.com/abc-defg-hij' },
      myPartstat: 'ACCEPTED',
    })
    expect(toMeetings([o as RawOccurrence])[0]?.join).toMatchObject({ provider: 'meet' })
  })

  it('reports all-day events as local dates with an exclusive end (default one day)', () => {
    const [offsite] = byUid(snap, 'offsite-2d@google.com')
    expect(offsite).toMatchObject({
      allDay: true,
      startDate: '2026-10-28',
      endDate: '2026-10-30',
      timezone: null,
    })
    expect(offsite?.start).toBe(local(2026, 10, 28, 0))
    expect(offsite?.end).toBe(local(2026, 10, 30, 0))
    const [holiday] = byUid(snap, 'holiday-1101@google.com')
    expect(holiday).toMatchObject({ allDay: true, startDate: '2026-11-01', endDate: '2026-11-02' })
  })

  it('without `me` there is no response', () => {
    const s = expandIcs(fixture('google-warsaw.ics'), OCT, DEC)
    expect(s.occurrences.every((o) => o.myPartstat === null)).toBe(true)
    expect(s.calendars[0]?.id).toBe('ics')
  })
})

describe('expandIcs — Outlook export with bare / Windows TZIDs and no VTIMEZONE', () => {
  const snap = expandIcs(fixture('outlook-newyork.ics'), OCT, DEC, { me: ME, calendarName: 'Outlook' })

  it('converts America/New_York across the US DST change (1 Nov), stopping at COUNT', () => {
    const s = byUid(snap, '040000008200E00074C5B7101A82E00800000000A1B2C3D4')
    expect(s.map((o) => [o.start, o.end])).toEqual([
      ['2026-10-22T14:00:00.000Z', '2026-10-22T14:30:00.000Z'],
      ['2026-10-29T14:00:00.000Z', '2026-10-29T14:30:00.000Z'],
      ['2026-11-05T15:00:00.000Z', '2026-11-05T15:30:00.000Z'],
      ['2026-11-12T15:00:00.000Z', '2026-11-12T15:30:00.000Z'],
    ])
    expect(s[0]).toMatchObject({
      timezone: 'America/New_York',
      myPartstat: 'NEEDS-ACTION',
      organizer: 'erin@partner.example',
      calendarName: 'Outlook',
      xprops: {
        'X-MICROSOFT-SKYPETEAMSMEETINGURL':
          'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0',
      },
    })
  })

  it('maps a Windows zone name and honours DURATION', () => {
    const [o] = byUid(snap, '040000008200E00074C5B7101A82E00800000000FFEE0011')
    expect(o).toMatchObject({
      start: '2026-11-02T14:00:00.000Z',
      end: '2026-11-02T15:30:00.000Z',
      timezone: 'America/New_York',
      attendees: 2,
      myPartstat: 'ACCEPTED',
    })
    // only X- values that are links count
    expect(o?.xprops).toEqual({
      'X-MICROSOFT-ONLINEMEETINGEXTERNALLINK': 'https://teams.microsoft.com/l/meetup-join/19%3aplan',
    })
  })

  it('resolves TZIDs to IANA zones', () => {
    expect(ianaZone('Europe/Warsaw')).toBe('Europe/Warsaw')
    expect(ianaZone('/mozilla.org/20050126_1/Europe/Warsaw')).toBe('Europe/Warsaw')
    expect(ianaZone('Eastern Standard Time')).toBe('America/New_York')
    expect(ianaZone('Not/AZone')).toBeNull()
  })
})

describe('expandIcs — rules', () => {
  const { logger, warn } = stubLogger()
  const snap = expandIcs(fixture('monthly-rules.ics'), OCT, d('2027-04-01T00:00:00Z'), { logger })

  it('2nd Tuesday with COUNT', () => {
    expect(starts(byUid(snap, 'second-tuesday@example.com'))).toEqual([
      '2026-10-13T15:00:00.000Z',
      '2026-11-10T15:00:00.000Z',
      '2026-12-08T15:00:00.000Z',
      '2027-01-12T15:00:00.000Z',
      '2027-02-09T15:00:00.000Z',
      '2027-03-09T15:00:00.000Z',
    ])
  })

  it('last Friday with a UTC UNTIL compared on absolute instants (bare TZID)', () => {
    // 25 Dec 16:00 Warsaw is exactly the UNTIL instant, so it is included
    expect(starts(byUid(snap, 'last-friday@example.com'))).toEqual([
      '2026-10-30T15:00:00.000Z',
      '2026-11-27T15:00:00.000Z',
      '2026-12-25T15:00:00.000Z',
    ])
  })

  it('every other month on the 15th, floating, plus an RDATE', () => {
    expect(starts(byUid(snap, 'mid-month@example.com'))).toEqual([
      local(2026, 10, 15, 12),
      local(2026, 11, 3, 12),
      local(2026, 12, 15, 12),
      local(2027, 2, 15, 12),
    ])
    expect(byUid(snap, 'mid-month@example.com')[0]?.timezone).toBeNull()
  })

  it('yearly all-day from years ago, and DAILY INTERVAL with COUNT and EXDATE', () => {
    expect(byUid(snap, 'yearly@example.com').map((o) => [o.startDate, o.endDate])).toEqual([
      ['2026-11-04', '2026-11-05'],
    ])
    expect(starts(byUid(snap, 'every-other-day@example.com'))).toEqual([
      '2026-11-01T06:00:00.000Z',
      '2026-11-05T06:00:00.000Z',
      '2026-11-07T06:00:00.000Z',
      '2026-11-09T06:00:00.000Z',
    ])
    expect(byUid(snap, 'every-other-day@example.com')[0]?.end).toBe('2026-11-01T06:45:00.000Z')
  })

  it('skips a malformed event with a warning and keeps the rest', () => {
    expect(byUid(snap, 'broken-date@example.com')).toEqual([])
    expect(warn).toHaveBeenCalledWith(
      'ics: event skipped',
      expect.objectContaining({ uid: 'broken-date@example.com' }),
    )
  })

  it('recovers the good events from a file with a syntax error', () => {
    const { logger: l2, warn: w2 } = stubLogger()
    const s = expandIcs(fixture('syntax-error.ics'), OCT, DEC, { logger: l2 })
    expect(s.occurrences.map((o) => o.uid)).toEqual(['good-1@example.com', 'good-2@example.com'])
    expect(s.calendars[0]?.name).toBe('Hand edited')
    expect(w2).toHaveBeenCalled()
  })

  it('rejects text that is not iCalendar', () => {
    expect(() => expandIcs('<html>login</html>', OCT, DEC)).toThrow(/not an iCalendar/)
  })

  it('bare Europe/Warsaw: 07:00Z in summer, 08:00Z in winter, and across the change in a series', () => {
    const text = cal(
      vevent({ UID: 'summer', 'DTSTART;TZID=Europe/Warsaw': '20260715T090000', DTEND: '20260715T080000Z' }),
      vevent({ UID: 'winter', 'DTSTART;TZID=Europe/Warsaw': '20270115T090000' }),
      vevent({
        UID: 'series',
        'DTSTART;TZID=Europe/Warsaw': '20261023T090000',
        'DTEND;TZID=Europe/Warsaw': '20261023T100000',
        RRULE: 'FREQ=DAILY;COUNT=4',
      }),
    )
    const s = expandIcs(text, d('2026-07-01T00:00:00Z'), d('2027-02-01T00:00:00Z'))
    expect(byUid(s, 'summer')[0]).toMatchObject({
      start: '2026-07-15T07:00:00.000Z',
      end: '2026-07-15T08:00:00.000Z',
    })
    // no DTEND or DURATION: zero length
    expect(byUid(s, 'winter')[0]).toMatchObject({
      start: '2027-01-15T08:00:00.000Z',
      end: '2027-01-15T08:00:00.000Z',
    })
    expect(byUid(s, 'series').map((o) => [o.start, o.end])).toEqual([
      ['2026-10-23T07:00:00.000Z', '2026-10-23T08:00:00.000Z'],
      ['2026-10-24T07:00:00.000Z', '2026-10-24T08:00:00.000Z'],
      ['2026-10-25T08:00:00.000Z', '2026-10-25T09:00:00.000Z'],
      ['2026-10-26T08:00:00.000Z', '2026-10-26T09:00:00.000Z'],
    ])
  })

  it('reads a nonexistent spring-forward time with the pre-gap offset', () => {
    const text = cal(vevent({ UID: 'gap', 'DTSTART;TZID=America/New_York': '20270314T023000' }))
    const s = expandIcs(text, d('2027-03-01T00:00:00Z'), d('2027-04-01T00:00:00Z'))
    expect(s.occurrences[0]?.start).toBe('2027-03-14T07:30:00.000Z')
  })

  it('uses the file’s own VTIMEZONE for a TZID Intl does not know', () => {
    const text = cal(
      [
        'BEGIN:VTIMEZONE',
        'TZID:Custom Office Time',
        'BEGIN:STANDARD',
        'DTSTART:19700101T000000',
        'TZOFFSETFROM:+0530',
        'TZOFFSETTO:+0530',
        'END:STANDARD',
        'END:VTIMEZONE',
      ].join('\r\n'),
      vevent({ UID: 'custom', 'DTSTART;TZID=Custom Office Time': '20261020T090000', DURATION: 'PT30M' }),
    )
    const [o] = expandIcs(text, OCT, DEC).occurrences
    expect(o).toMatchObject({
      start: '2026-10-20T03:30:00.000Z',
      end: '2026-10-20T04:00:00.000Z',
      timezone: 'Custom Office Time',
    })
  })

  it('matches a UTC EXDATE and a UTC RECURRENCE-ID against a zoned series', () => {
    const text = cal(
      vevent({
        UID: 's',
        SUMMARY: 'Series',
        'DTSTART;TZID=America/New_York': '20261026T100000',
        DURATION: 'PT1H',
        RRULE: 'FREQ=DAILY;COUNT=5',
        EXDATE: '20261027T140000Z',
      }),
      vevent({
        UID: 's',
        SUMMARY: 'Moved',
        'RECURRENCE-ID': '20261028T140000Z',
        DTSTART: '20261028T200000Z',
        DURATION: 'PT1H',
      }),
    )
    const s = expandIcs(text, OCT, DEC)
    expect(s.occurrences.map((o) => [o.start, o.summary, o.recurrenceId])).toEqual([
      ['2026-10-26T14:00:00.000Z', 'Series', '2026-10-26T14:00:00.000Z'],
      ['2026-10-28T20:00:00.000Z', 'Moved', '2026-10-28T14:00:00.000Z'],
      ['2026-10-29T14:00:00.000Z', 'Series', '2026-10-29T14:00:00.000Z'],
      ['2026-10-30T14:00:00.000Z', 'Series', '2026-10-30T14:00:00.000Z'],
    ])
  })

  it('an override moved out of the window removes its instance; one moved into it appears', () => {
    const text = cal(
      vevent({ UID: 'w', DTSTART: '20261005T100000Z', DURATION: 'PT1H', RRULE: 'FREQ=WEEKLY;COUNT=4' }),
      vevent({
        UID: 'w',
        'RECURRENCE-ID': '20261012T100000Z',
        DTSTART: '20261201T100000Z',
        DURATION: 'PT1H',
      }),
      vevent({
        UID: 'w',
        'RECURRENCE-ID': '20261026T100000Z',
        DTSTART: '20261009T100000Z',
        DURATION: 'PT1H',
      }),
    )
    const s = expandIcs(text, d('2026-10-01T00:00:00Z'), d('2026-10-20T00:00:00Z'))
    expect(starts(s.occurrences)).toEqual([
      '2026-10-05T10:00:00.000Z',
      '2026-10-09T10:00:00.000Z',
      '2026-10-19T10:00:00.000Z',
    ])
  })

  it('includes occurrences overlapping the window edges, excludes ones merely touching them', () => {
    const text = cal(
      vevent({ UID: 'straddles-start', DTSTART: '20261009T230000Z', DTEND: '20261010T010000Z' }),
      vevent({ UID: 'ends-at-start', DTSTART: '20261009T220000Z', DTEND: '20261010T000000Z' }),
      vevent({ UID: 'straddles-end', DTSTART: '20261010T235900Z', DTEND: '20261011T003000Z' }),
      vevent({ UID: 'starts-at-end', DTSTART: '20261011T000000Z', DTEND: '20261011T010000Z' }),
      vevent({ UID: 'instant-at-start', DTSTART: '20261010T000000Z' }),
    )
    const s = expandIcs(text, d('2026-10-10T00:00:00Z'), d('2026-10-11T00:00:00Z'))
    expect(s.occurrences.map((o) => o.uid).sort()).toEqual([
      'instant-at-start',
      'straddles-end',
      'straddles-start',
    ])
  })

  it('caps runaway expansion per event and keeps the other events', () => {
    const { logger: l3, warn: w3 } = stubLogger()
    const text = cal(
      vevent({ UID: 'minutely', DTSTART: '20261001T000000Z', RRULE: 'FREQ=MINUTELY' }),
      vevent({ UID: 'secondly-forever', DTSTART: '20000101T000000Z', RRULE: 'FREQ=SECONDLY' }),
      vevent({ UID: 'fine', DTSTART: '20261002T100000Z', DURATION: 'PT1H' }),
    )
    const t0 = Date.now()
    const s = expandIcs(text, OCT, d('2026-10-15T00:00:00Z'), { logger: l3 })
    expect(Date.now() - t0).toBeLessThan(5000)
    expect(s.occurrences.map((o) => o.uid)).toEqual(['fine'])
    const skipped = w3.mock.calls.filter((c) => c[0] === 'ics: event skipped').map((c) => c[1].uid)
    expect(skipped.sort()).toEqual(['minutely', 'secondly-forever'])
    // a smaller cap applies to reasonable rules too
    const daily = cal(vevent({ UID: 'daily', DTSTART: '20261001T090000Z', RRULE: 'FREQ=DAILY' }))
    expect(expandIcs(daily, OCT, DEC, { maxPerEvent: 10 }).occurrences).toEqual([])
    expect(expandIcs(daily, OCT, DEC, { maxPerEvent: 61 }).occurrences).toHaveLength(61)
  })
})

// ------------------------------------------------------------------------------------------ provider

type Rec = { snaps: CalendarSnapshot[]; states: [CalendarState, string | null][]; l: ProviderListener }
function listener(): Rec {
  const snaps: CalendarSnapshot[] = []
  const states: [CalendarState, string | null][] = []
  return { snaps, states, l: { snapshot: (s) => snaps.push(s), status: (s, det) => states.push([s, det]) } }
}
const lastState = (r: Rec) => r.states.at(-1)

describe('IcsCalendarProvider — file', () => {
  let dir: string
  let p: IcsCalendarProvider | null = null
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kacola-ics-'))
  })
  afterEach(async () => {
    await p?.stop()
    p = null
    rmSync(dir, { recursive: true, force: true })
  })

  it('emits nothing until a window is set, then re-reads the file when it changes', async () => {
    const file = join(dir, 'team.ics')
    writeFileSync(
      file,
      cal(vevent({ UID: 'a', SUMMARY: 'A', DTSTART: '20261020T090000Z', DURATION: 'PT1H' })),
    )
    const r = listener()
    p = new IcsCalendarProvider({ source: file, pollMs: 20, me: ME })
    p.start(r.l)
    expect(r.states[0]).toEqual(['starting', null])
    await new Promise((res) => setTimeout(res, 60))
    expect(r.snaps).toHaveLength(0)

    p.setWindow(OCT, DEC)
    expect(r.snaps).toHaveLength(1)
    expect(r.snaps[0]?.calendars).toEqual([{ id: icsSourceUid(file), name: 'team' }])
    expect(r.snaps[0]?.occurrences.map((o) => o.summary)).toEqual(['A'])
    expect(lastState(r)).toEqual(['ok', null])

    writeFileSync(
      file,
      cal('X-WR-CALNAME:Team', vevent({ UID: 'b', SUMMARY: 'B', DTSTART: '20261021T090000Z' })),
    )
    await vi.waitFor(() => expect(r.snaps.at(-1)?.occurrences.map((o) => o.summary)).toEqual(['B']), {
      timeout: 3000,
    })
    expect(r.snaps.at(-1)?.calendars[0]?.name).toBe('Team')

    // a narrower window re-expands the cached parse
    p.setWindow(d('2026-10-22T00:00:00Z'), DEC)
    expect(r.snaps.at(-1)?.occurrences).toEqual([])
  })

  it('reports a missing file as unavailable, keeps the last snapshot, and recovers', async () => {
    const file = join(dir, 'gone.ics')
    const r = listener()
    p = new IcsCalendarProvider({ source: file, pollMs: 20, name: 'Mine' })
    p.start(r.l)
    p.setWindow(OCT, DEC)
    expect(lastState(r)?.[0]).toBe('unavailable')
    expect(lastState(r)?.[1]).toMatch(/does not exist/)
    expect(r.snaps).toHaveLength(0)

    writeFileSync(file, cal(vevent({ UID: 'a', DTSTART: '20261020T090000Z' })))
    await vi.waitFor(() => expect(r.snaps).toHaveLength(1), { timeout: 3000 })
    expect(r.snaps[0]?.calendars[0]?.name).toBe('Mine')
    expect(lastState(r)).toEqual(['ok', null])

    unlinkSync(file)
    await vi.waitFor(() => expect(lastState(r)?.[0]).toBe('unavailable'), { timeout: 3000 })
    expect(r.snaps).toHaveLength(1)
    // a window change still serves the last good copy, without claiming the source is fine
    p.setWindow(OCT, d('2026-12-02T00:00:00Z'))
    expect(r.snaps).toHaveLength(2)
    expect(lastState(r)?.[0]).toBe('unavailable')
  })

  it('reports a file that is not iCalendar as unavailable', () => {
    const file = join(dir, 'bad.ics')
    writeFileSync(file, 'hello')
    const r = listener()
    p = new IcsCalendarProvider({ source: `file://${file}`, pollMs: 20 })
    p.start(r.l)
    p.setWindow(OCT, DEC)
    expect(r.snaps).toHaveLength(0)
    expect(lastState(r)?.[1]).toMatch(/not an iCalendar/)
  })
})

describe('IcsCalendarProvider — URL', () => {
  let p: IcsCalendarProvider | null = null
  afterEach(async () => {
    await p?.stop()
    p = null
    vi.useRealTimers()
  })

  const body = (summary: string) =>
    cal(vevent({ UID: 'u', SUMMARY: summary, DTSTART: '20261020T090000Z', DURATION: 'PT1H' }))

  it('fetches, refetches on the interval and on refresh(), and keeps the last copy on failure', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    const responses: (() => Promise<Response>)[] = [
      async () => new Response(body('One'), { status: 200 }),
      async () => new Response(body('Two'), { status: 200 }),
      async () => new Response('nope', { status: 503 }),
      async () => {
        throw new TypeError('fetch failed')
      },
      async () => new Response(body('Three'), { status: 200 }),
    ]
    const calls: string[] = []
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      calls.push(String(url))
      const next = responses.shift()
      if (!next) throw new Error('no more responses')
      return next()
    }) as unknown as typeof fetch
    const r = listener()
    p = new IcsCalendarProvider({
      source: 'webcal://cal.example.com/private-SECRET/basic.ics',
      fetch: fetchFn,
      pollMs: 60_000,
    })
    expect(p.fetchUrl).toBe('https://cal.example.com/private-SECRET/basic.ics')
    p.start(r.l)
    p.setWindow(OCT, DEC)
    await vi.waitFor(() => expect(r.snaps).toHaveLength(1))
    expect(calls).toEqual(['https://cal.example.com/private-SECRET/basic.ics'])
    expect(r.snaps[0]?.calendars[0]?.name).toBe('cal.example.com')
    expect(r.snaps[0]?.occurrences[0]?.summary).toBe('One')
    expect(lastState(r)).toEqual(['ok', null])

    await vi.advanceTimersByTimeAsync(60_000)
    await vi.waitFor(() => expect(r.snaps.at(-1)?.occurrences[0]?.summary).toBe('Two'))

    p.refresh() // 503
    await vi.waitFor(() => expect(lastState(r)?.[0]).toBe('unavailable'))
    expect(lastState(r)?.[1]).toMatch(/HTTP 503/)
    // the detail names the host only: the path of a subscription URL is its secret
    expect(lastState(r)?.[1]).not.toContain('SECRET')
    expect(r.snaps).toHaveLength(2)

    await vi.advanceTimersByTimeAsync(60_000) // network error
    await vi.waitFor(() => expect(lastState(r)?.[1]).toMatch(/fetch failed/))
    expect(r.snaps).toHaveLength(2)
    p.setWindow(OCT, DEC)
    expect(r.snaps.at(-1)?.occurrences[0]?.summary).toBe('Two')
    expect(lastState(r)?.[0]).toBe('unavailable')

    p.refresh()
    await vi.waitFor(() => expect(r.snaps.at(-1)?.occurrences[0]?.summary).toBe('Three'))
    expect(lastState(r)).toEqual(['ok', null])
    expect(fetchFn).toHaveBeenCalledTimes(5)
  })

  it('times out a hanging fetch', async () => {
    const fetchFn = ((_u: string, init?: RequestInit) =>
      new Promise((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new Error('aborted')))
      })) as unknown as typeof fetch
    const r = listener()
    p = new IcsCalendarProvider({ source: 'https://slow.example.com/cal.ics', fetch: fetchFn, timeoutMs: 50 })
    p.start(r.l)
    await vi.waitFor(() =>
      expect(lastState(r)).toEqual(['unavailable', 'calendar slow.example.com: timed out']),
    )
  })

  describe('against a real HTTP server', () => {
    let server: Server
    let text = ''
    let status = 200
    let hits = 0
    beforeEach(async () => {
      server = createServer((req, res) => {
        hits++
        if (req.url !== '/feed.ics') {
          res.writeHead(404).end()
          return
        }
        res.writeHead(status, { 'content-type': 'text/calendar; charset=utf-8' }).end(text)
      })
      await new Promise<void>((res) => server.listen(0, '127.0.0.1', res))
    })
    afterEach(async () => {
      await new Promise((res) => server.close(res))
    })

    it('serves the fixture, then keeps it through a 500', async () => {
      text = fixture('google-warsaw.ics')
      status = 200
      hits = 0
      const port = (server.address() as AddressInfo).port
      const r = listener()
      p = new IcsCalendarProvider({ source: `http://127.0.0.1:${port}/feed.ics`, me: ME })
      p.start(r.l)
      p.setWindow(OCT, DEC)
      await vi.waitFor(() => expect(r.snaps).toHaveLength(1), { timeout: 3000 })
      expect(r.snaps[0]?.calendars[0]?.name).toBe('Work')
      expect(r.snaps[0]?.occurrences.find((o) => o.uid === 'roadmap-91bd@google.com')?.myPartstat).toBe(
        'DECLINED',
      )

      status = 500
      p.refresh()
      await vi.waitFor(() => expect(lastState(r)?.[1]).toMatch(/HTTP 500/), { timeout: 3000 })
      expect(r.snaps).toHaveLength(1)
      expect(hits).toBe(2)
    })

    it('reports a 404 as unavailable', async () => {
      const port = (server.address() as AddressInfo).port
      const r = listener()
      p = new IcsCalendarProvider({ source: `http://127.0.0.1:${port}/missing.ics` })
      p.start(r.l)
      await vi.waitFor(() => expect(lastState(r)?.[1]).toMatch(/HTTP 404/), { timeout: 3000 })
      expect(r.snaps).toHaveLength(0)
    })
  })
})
