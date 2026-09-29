import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type DaemonHandle, startDaemon, waitFor } from '@gnomeola/testkit/daemon'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { gnomeola } from '../src/cli.ts'
import { normalise } from '../src/seed.ts'

// X-5 / V-6a — `gnomeola meetings` through the REAL daemon and its calendar service, fed by a calendar
// file (GNOMEOLA_CALENDAR=file:…, the same RawOccurrence shape cal-agent emits from EDS). Outputs are
// compared to reviewed golden files, with times normalised.

const box = mkdtempSync(join(tmpdir(), 'gnomeola-e2e-meetings-'))
const calFile = join(box, 'calendar.json')
let d: DaemonHandle

type Occ = Record<string, unknown>
const occ = (o: Occ): Occ => ({
  sourceUid: 'cal-work',
  calendarName: 'Work',
  recurrenceId: null,
  description: '',
  location: '',
  url: '',
  allDay: false,
  startDate: null,
  endDate: null,
  timezone: 'Europe/Warsaw',
  status: 'CONFIRMED',
  myPartstat: null,
  organizer: 'mailto:ana@example.com',
  attendees: 3,
  recurring: false,
  xprops: {},
  ...o,
})

/** Replace the calendar atomically (as a real writer would) and wait for the daemon to pick it up. */
async function writeCalendar(occurrences: Occ[], probe: () => Promise<boolean>) {
  writeFileSync(
    `${calFile}.tmp`,
    JSON.stringify({ calendars: [{ id: 'cal-work', name: 'Work' }], occurrences }),
  )
  renameSync(`${calFile}.tmp`, calFile)
  await waitFor(probe, 10_000, 'the daemon to re-read the calendar file')
}

beforeAll(async () => {
  writeFileSync(calFile, '[]')
  d = await startDaemon({ env: { GNOMEOLA_CALENDAR: `file:${calFile}` } })
}, 60_000)
afterAll(async () => {
  await d?.stop()
  rmSync(box, { recursive: true, force: true })
})

const golden = (name: string) => join(import.meta.dirname, '__golden__', `${name}.json`)
const stable = (out: string) => normalise(out).replace(/"\d{4}-\d{2}-\d{2}"/g, '"<date>"')

describe('meetings through the real daemon', () => {
  it('--next: the meeting in progress and the next one, join link extracted from an HTML Zoom body', async () => {
    const now = Date.now()
    const t = (min: number) => new Date(now + min * 60_000).toISOString()
    await writeCalendar(
      [
        occ({ uid: 'review@x', summary: 'Design review', start: t(-10), end: t(20), location: 'Room 4' }),
        occ({ uid: 'pitch@x', summary: 'Vendor pitch', start: t(5), end: t(35), myPartstat: 'DECLINED' }),
        occ({
          uid: 'call@x',
          summary: 'Customer call',
          start: t(30),
          end: t(60),
          myPartstat: 'ACCEPTED',
          description:
            '<p>Join Zoom Meeting<br><a href="https://us02web.zoom.us/j/84518302211?pwd=abc&amp;from=addon">link</a></p>',
        }),
      ],
      async () => (await d.client.call('nextMeeting')).next?.title === 'Customer call',
    )
    const r = await gnomeola(['meetings', '--next'], d.baseUrl)
    expect(r.stderr).toBe('')
    expect(r.code).toBe(0)
    await expect(stable(r.stdout)).toMatchFileSnapshot(golden('meetings-next'))
  })

  it('--today: the local day, all-day first, declined hidden', async () => {
    const day = new Date()
    const local = (h: number, m = 0) =>
      new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).toISOString()
    const ymd = (offset: number) => {
      const x = new Date(day.getFullYear(), day.getMonth(), day.getDate() + offset)
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    }
    await writeCalendar(
      [
        // a fixed RECURRENCE-ID keeps the occurrence id (and so the golden) stable from day to day
        occ({
          uid: 'standup@x',
          recurrenceId: '2026-10-26T08:00:00.000Z',
          recurring: true,
          summary: 'Standup',
          start: local(9),
          end: local(9, 15),
          xprops: { 'X-GOOGLE-CONFERENCE': 'https://meet.google.com/xqc-bnvd-kpt' },
        }),
        occ({
          uid: 'offsite@x',
          summary: 'Team offsite',
          allDay: true,
          startDate: ymd(0),
          endDate: ymd(1),
          start: local(0),
          end: local(0),
        }),
        occ({
          uid: 'lunch@x',
          summary: 'Lunch',
          start: local(12, 30),
          end: local(13, 30),
          myPartstat: 'DECLINED',
        }),
        occ({
          uid: 'sync@x',
          summary: 'Planning sync',
          start: local(16),
          end: local(17),
          myPartstat: 'TENTATIVE',
          description:
            'Click here to join the meeting<https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%7d>',
        }),
        occ({ uid: 'tomorrow@x', summary: 'Tomorrow', start: local(33), end: local(34) }),
      ],
      async () =>
        (await d.client.call('listMeetings', { query: { from: local(0), to: local(24) } })).meetings
          .length === 3,
    )
    const r = await gnomeola(['meetings', '--today'], d.baseUrl)
    expect(r.stderr).toBe('')
    expect(r.code).toBe(0)
    await expect(stable(r.stdout)).toMatchFileSnapshot(golden('meetings-today'))
    // …and what a person at a terminal sees
    const tty = await gnomeola(['meetings', '--today'], d.baseUrl, { tty: true })
    expect(tty.stdout.split('\n').filter(Boolean)).toEqual([
      'all day      Team offsite',
      '09:00–09:15  Standup  meet: https://meet.google.com/xqc-bnvd-kpt',
      '16:00–17:00  Planning sync (tentative)  teams: https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%7d',
    ])
  })

  it('a broken calendar file is exit 6 with the reason; sessions know the meeting they recorded', async () => {
    const { next } = await d.client.call('nextMeeting')
    writeFileSync(calFile, '{ not json')
    await waitFor(
      async () => (await d.client.call('calendarStatus')).state === 'unavailable',
      10_000,
      'unavailable',
    )
    const r = await gnomeola(['meetings'], d.baseUrl)
    expect(r.code).toBe(6)
    expect(r.stderr).toMatch(/calendar unavailable: calendar file .*calendar\.json/)
    // meetings already known stay joinable
    if (next) {
      const j = await d.client.call('joinMeeting', { params: { id: next.id }, body: {} })
      const list = JSON.parse((await gnomeola(['sessions', 'list'], d.baseUrl)).stdout)
      expect(list.sessions[0]).toMatchObject({
        id: j.session.id,
        meeting: { id: next.id, title: next.title },
      })
      await d.client.call('stopSession', { params: { id: j.session.id } })
    }
  })
})
