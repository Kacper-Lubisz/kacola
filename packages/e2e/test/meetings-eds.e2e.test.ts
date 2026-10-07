import type { Meeting } from '@kacola/protocol'
import { type DaemonHandle, startDaemon, waitFor } from '@kacola/testkit/daemon'
import {
  CALENDARS,
  type EdsHandle,
  EXPECTED,
  LINKS,
  type LiveFixture,
  liveFixture,
  startEds,
  WINDOW,
} from '@kacola/testkit/eds'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// V-4c through the whole stack: the REAL daemon, spawning the REAL cal-agent, reading a REAL (isolated,
// seeded) Evolution Data Server — asserted through the HTTP API the Shell extension, the CLI and the
// window use. The exhaustive occurrence-by-occurrence checks (DST, recurrences, exceptions) live at the
// agent level (packages/daemon/test/cal-agent.e2e.test.ts); here: nothing is lost or mis-timed on the way
// through, the join links come out extracted, and "current / next" is right against the wall clock.

let eds: EdsHandle
let daemon: DaemonHandle
let live: LiveFixture

const ms = (iso: string) => Date.parse(iso)
/** Local midnight of a date in the fixture zone (Europe/Warsaw), as epoch ms. */
const warsawMidnight = (date: string) => {
  // Warsaw is UTC+2 in summer time and UTC+1 otherwise; pick the offset that lands on 00:00 local.
  for (const off of [1, 2]) {
    const t = Date.parse(`${date}T00:00:00.000Z`) - off * 3_600_000
    if (
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Warsaw',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(t) === '00'
    )
      return t
  }
  throw new Error(`no midnight for ${date}`)
}

describe('meetings from EDS through the real daemon', () => {
  beforeAll(async () => {
    live = liveFixture(new Date())
    eds = await startEds({ calendars: [...CALENDARS, live.calendar] })
    daemon = await startDaemon({
      env: { ...eds.env, KACOLA_CALENDAR: 'eds', KACOLA_DBUS: 'off' },
    })
    await waitFor(
      async () => (await daemon.client.call('calendarStatus')).state === 'ok',
      30_000,
      'the calendar to be ready',
    )
  }, 120_000)

  afterAll(async () => {
    await daemon?.stop()
    await eds?.close()
  })

  it('reports the calendars it reads, and never the disabled one', async () => {
    const s = await daemon.client.call('calendarStatus')
    expect(s).toMatchObject({ state: 'ok', provider: 'eds', detail: null })
    const ids = s.calendars.map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining(['kacola-work', 'kacola-personal', 'kacola-live']))
    expect(ids).not.toContain('kacola-disabled')
  })

  it('knows what is on now and what is next (declined and all-day meetings are neither)', async () => {
    const n = await daemon.client.call('nextMeeting')
    expect(n.current).toMatchObject({
      uid: 'live-current@test',
      title: 'Current Zoom',
      start: expect.any(String),
      join: { provider: 'zoom' },
    })
    expect(ms(n.current!.start)).toBe(ms(live.times['live-current@test']!.start))
    expect(n.next).toMatchObject({
      uid: 'live-next@test',
      title: 'Next Meet',
      join: { url: LINKS.meet, provider: 'meet' },
    })
    expect(ms(n.next!.start)).toBe(ms(live.times['live-next@test']!.start))
    expect(ms(n.next!.end)).toBe(ms(live.times['live-next@test']!.end))
  })

  it('lists today, hiding the declined meeting unless asked', async () => {
    const today = await daemon.client.call('listMeetings', { query: {} })
    const uids = today.meetings.map((m) => m.uid)
    expect(uids).toContain('live-next@test')
    expect(uids).not.toContain('live-declined@test')
    const all = await daemon.client.call('listMeetings', { query: { includeDeclined: true } })
    expect(all.meetings.find((m) => m.uid === 'live-declined@test')).toMatchObject({ response: 'declined' })
    const allDay = all.meetings.find((m) => m.uid === 'live-allday@test')
    expect(allDay).toMatchObject({ allDay: true })
    expect(ms(allDay!.start)).toBe(warsawMidnight(live.today))
  })

  // The fixed-date fixtures lie in Oct–Nov 2026, mostly outside the daemon's rolling window: asking for
  // their range makes the daemon widen the window and wait for cal-agent to re-expand.
  it('carries the fixed fixtures through unchanged when asked for their window', async () => {
    const r = await daemon.client.call('listMeetings', {
      query: { from: WINDOW.from, to: WINDOW.to, includeDeclined: true },
    })
    const got = r.meetings.filter((m) => m.calendar.id !== 'kacola-live')
    const key = (uid: string, start: number) => `${uid} @ ${new Date(start).toISOString()}`
    const gotKeys = new Set(got.map((m) => key(m.uid, ms(m.start))))
    const want = EXPECTED.filter((e) => e.status !== 'CANCELLED').map((e) =>
      key(e.uid, e.allDay ? warsawMidnight(e.startDate!) : ms(e.start!)),
    )
    for (const k of want) expect(gotKeys, k).toContain(k)
    const one = (uid: string): Meeting => got.find((m) => m.uid === uid)!
    expect(one('standup-warsaw@test').join).toEqual({ url: LINKS.meet, provider: 'meet' })
    expect(one('ny-sync@test').join).toEqual({
      url: 'https://acme.zoom.us/j/81234567890?pwd=AbC123&from=addon',
      provider: 'zoom',
    })
    expect(one('utc-review@test').join).toMatchObject({ provider: 'teams' })
    expect(one('utc-review@test').join!.url).toContain('teams.microsoft.com/l/meetup-join/')
    expect(one('google-conf@test').join).toEqual({ url: LINKS.googleConference, provider: 'meet' })
    expect(one('webex@test').join).toEqual({ url: LINKS.webex, provider: 'webex' })
    expect(one('declined@test')).toMatchObject({ response: 'declined', organizer: 'boss@example.com' })
    expect(one('tentative@test').response).toBe('tentative')
    expect(one('dentist@test').calendar).toEqual({ id: 'kacola-personal', name: 'Personal things' })
    // the DST boundary survives the daemon too
    const standups = got.filter((m) => m.uid === 'standup-warsaw@test').map((m) => m.start.slice(11, 16))
    expect(standups).toEqual(['07:00', '08:00', '08:00', '08:00'])
  })

  it('picks up a meeting added in the calendar while running', async () => {
    const start = new Date(Math.ceil(Date.now() / 60_000) * 60_000 + 90 * 60_000)
    const ics = (d: Date) => `${d.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`
    await eds.createEvent(
      'kacola-live',
      [
        'BEGIN:VEVENT',
        'UID:live-added@test',
        'DTSTAMP:20260901T000000Z',
        'SUMMARY:Added while running',
        `DTSTART:${ics(start)}`,
        `DTEND:${ics(new Date(start.getTime() + 30 * 60_000))}`,
        'LOCATION:https://zoom.us/j/99999999999',
        'END:VEVENT',
      ].join('\n'),
    )
    const found = await waitFor(
      async () =>
        (
          await daemon.client.call('listMeetings', {
            query: { to: new Date(start.getTime() + 3_600_000).toISOString() },
          })
        ).meetings.find((m) => m.uid === 'live-added@test'),
      15_000,
      'the added meeting',
    )
    expect(found).toMatchObject({ title: 'Added while running', join: { provider: 'zoom' } })
    expect(ms(found.start)).toBe(start.getTime())
  })
})
