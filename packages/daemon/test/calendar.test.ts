import type { AnyEvent, Meeting } from '@gnomeola/protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventBus } from '../src/bus.ts'
import {
  currentAndNext,
  endOfLocalDay,
  inWindow,
  localMidnight,
  meetingId,
  toMeeting,
  toMeetings,
  upcoming,
} from '../src/calendar/meetings.ts'
import { FileCalendarProvider, ManualCalendarProvider, parseCalendarFile } from '../src/calendar/providers.ts'
import { ANNOUNCE_MS, CalendarService } from '../src/calendar/service.ts'
import { Logger } from '../src/logger.ts'
import { otherMicUsers } from '../src/mic-activity.ts'
import { at, occ } from './calendar-helpers.ts'

const T0 = Date.parse('2026-10-26T09:00:00.000Z')

describe('toMeeting', () => {
  it('maps a timed invitation, with its join link, response and organizer', () => {
    const m = toMeeting(
      occ({
        summary: '  Weekly\n sync ',
        start: '2026-10-26T08:00:00Z',
        end: '2026-10-26T08:30:00Z',
        location: 'https://meet.google.com/abc-defg-hij',
        myPartstat: 'tentative',
        organizer: 'mailto:ana@example.com',
        attendees: 4,
        status: 'CONFIRMED',
        timezone: 'Europe/Warsaw',
      }),
    )
    expect(m).toMatchObject({
      title: 'Weekly sync',
      start: '2026-10-26T08:00:00.000Z',
      end: '2026-10-26T08:30:00.000Z',
      allDay: false,
      join: { url: 'https://meet.google.com/abc-defg-hij', provider: 'meet' },
      response: 'tentative',
      organizer: 'ana@example.com',
      attendees: 4,
      status: 'confirmed',
      timezone: 'Europe/Warsaw',
    })
    expect(m.id).toMatch(/^mtg_[\w-]{22}$/)
  })

  it('places all-day events on local midnights, exclusive end, defaulting to one day', () => {
    const one = toMeeting(
      occ({ allDay: true, startDate: '2026-10-25', endDate: null, start: T0Iso(), end: T0Iso() }),
    )
    expect(new Date(one.start).getTime()).toBe(localMidnight('2026-10-25').getTime())
    expect(new Date(one.end).getTime()).toBe(new Date(2026, 9, 26).getTime())
    const three = toMeeting(
      occ({ allDay: true, startDate: '2026-10-24', endDate: '2026-10-27', start: T0Iso(), end: T0Iso() }),
    )
    expect(new Date(three.end).getTime()).toBe(new Date(2026, 9, 27).getTime())
  })

  it('has a stable id per occurrence, distinct across instances and calendars', () => {
    expect(meetingId('a', 'u', null)).toBe(meetingId('a', 'u', null))
    expect(meetingId('a', 'u', '2026-10-26T08:00:00Z')).not.toBe(meetingId('a', 'u', '2026-11-02T08:00:00Z'))
    expect(meetingId('a', 'u', null)).not.toBe(meetingId('b', 'u', null))
  })

  it('maps cancelled, and untitled events', () => {
    const m = toMeeting(occ({ summary: '', status: 'CANCELLED', start: T0Iso(), end: T0Iso() }))
    expect(m.status).toBe('cancelled')
    expect(m.title).toBe('Untitled meeting')
  })

  it('dedupes the same invitation seen in two calendars, keeping the copy with my response', () => {
    const base = { uid: 'same@x', summary: 'Sync', start: at(T0, 60), end: at(T0, 90) }
    const ms = toMeetings([
      occ({ ...base, sourceUid: 'shared', calendarName: 'Team' }),
      occ({ ...base, sourceUid: 'mine', calendarName: 'Work', myPartstat: 'ACCEPTED' }),
      occ({ summary: 'Earlier', start: at(T0, 10), end: at(T0, 20) }),
    ])
    expect(ms.map((m) => [m.title, m.calendar.name, m.response])).toEqual([
      ['Earlier', 'Work', null],
      ['Sync', 'Work', 'accepted'],
    ])
  })
})

function T0Iso() {
  return new Date(T0).toISOString()
}

describe('selection: current, next, windows', () => {
  const ms = toMeetings([
    occ({
      summary: 'Holiday',
      allDay: true,
      startDate: '2026-10-26',
      endDate: '2026-10-27',
      start: T0Iso(),
      end: T0Iso(),
    }),
    occ({ summary: 'Long', start: at(T0, -60), end: at(T0, 60) }),
    occ({ summary: 'Overlapping', start: at(T0, -10), end: at(T0, 20) }),
    occ({ summary: 'Declined', start: at(T0, 5), end: at(T0, 15), myPartstat: 'DECLINED' }),
    occ({ summary: 'Cancelled', start: at(T0, 6), end: at(T0, 16), status: 'CANCELLED' }),
    occ({ summary: 'Next', start: at(T0, 30), end: at(T0, 60) }),
    occ({ summary: 'Also next (later title)', start: at(T0, 30), end: at(T0, 60) }),
    occ({ summary: 'Tomorrow', start: at(T0, 24 * 60), end: at(T0, 24 * 60 + 30) }),
  ])
  const now = new Date(T0)

  it('current = the most recently started of overlapping meetings; next = earliest future, ties by end then title', () => {
    const { current, next } = currentAndNext(ms, now)
    expect(current?.title).toBe('Overlapping')
    expect(next?.title).toBe('Also next (later title)')
  })

  it('ignores all-day, declined and cancelled for current/next', () => {
    const only = toMeetings([
      occ({ summary: 'Declined', start: at(T0, 5), end: at(T0, 15), myPartstat: 'DECLINED' }),
      occ({
        summary: 'Holiday',
        allDay: true,
        startDate: '2026-10-27',
        endDate: null,
        start: T0Iso(),
        end: T0Iso(),
      }),
    ])
    expect(currentAndNext(only, now)).toEqual({ current: null, next: null })
  })

  it('a meeting is current from its start (inclusive) to its end (exclusive)', () => {
    const one = toMeetings([occ({ summary: 'M', start: at(T0, 0), end: at(T0, 30) })])
    expect(currentAndNext(one, new Date(T0)).current?.title).toBe('M')
    expect(currentAndNext(one, new Date(T0 - 1)).next?.title).toBe('M')
    expect(currentAndNext(one, new Date(T0 + 30 * 60_000))).toEqual({ current: null, next: null })
  })

  it('windows are overlaps, and hide declined/cancelled unless asked', () => {
    const titles = (xs: Meeting[]) => xs.map((m) => m.title)
    expect(titles(inWindow(ms, new Date(T0), new Date(T0 + 10 * 60_000)))).toEqual(
      expect.arrayContaining(['Long', 'Overlapping']),
    )
    expect(titles(inWindow(ms, new Date(T0), new Date(T0 + 10 * 60_000)))).not.toContain('Declined')
    expect(titles(inWindow(ms, new Date(T0), new Date(T0 + 10 * 60_000), true))).toEqual(
      expect.arrayContaining(['Declined', 'Cancelled']),
    )
    // [from, to): a meeting ending exactly at `from` is not in it
    const timed = (xs: Meeting[]) => titles(xs.filter((m) => !m.allDay))
    expect(timed(inWindow(ms, new Date(T0 + 60 * 60_000), new Date(T0 + 61 * 60_000)))).toEqual([])
  })

  it('upcoming: timed meetings from now until a bound, in start order, capped', () => {
    expect(upcoming(ms, now, new Date(T0 + 12 * 3600_000), 3).map((m) => m.title)).toEqual([
      'Long',
      'Overlapping',
      'Also next (later title)',
    ])
  })

  it('endOfLocalDay is the next local midnight', () => {
    const d = new Date(2026, 9, 25, 13, 0)
    expect(endOfLocalDay(d).getTime()).toBe(new Date(2026, 9, 26).getTime())
    expect(endOfLocalDay(d, 1).getTime()).toBe(new Date(2026, 9, 27).getTime())
  })
})

describe('calendar file provider', () => {
  it('accepts a bare list or {calendars, occurrences}, deriving calendars when absent', () => {
    const o = occ({ start: T0Iso(), end: T0Iso() })
    expect(parseCalendarFile(JSON.stringify([o])).calendars).toEqual([{ id: 'cal-work', name: 'Work' }])
    expect(
      parseCalendarFile(JSON.stringify({ calendars: [{ id: 'x', name: 'X' }], occurrences: [o] })).calendars,
    ).toEqual([{ id: 'x', name: 'X' }])
    expect(() => parseCalendarFile('{"occurrences":[{"uid":1}]}')).toThrow()
  })

  it('reports a missing file as unavailable rather than failing', () => {
    const states: string[] = []
    const p = new FileCalendarProvider('/nonexistent/gnomeola-calendar.json')
    p.start({ snapshot: () => {}, status: (s, d) => states.push(`${s}:${d ?? ''}`) })
    void p.stop()
    expect(states.at(-1)).toMatch(/^unavailable:.*does not exist/)
  })
})

describe('CalendarService moments', () => {
  let provider: ManualCalendarProvider
  let bus: EventBus
  let svc: CalendarService
  let events: AnyEvent[]
  let now: number

  beforeEach(() => {
    vi.useFakeTimers()
    now = T0
    vi.setSystemTime(now)
    provider = new ManualCalendarProvider()
    bus = new EventBus(() => new Date(Date.now()))
    events = []
    bus.subscribe((e) => events.push(e))
    svc = new CalendarService({ provider, bus, logger: new Logger(), now: () => new Date(Date.now()) })
  })
  afterEach(async () => {
    await svc.stop()
    vi.useRealTimers()
  })

  const snap = (...o: ReturnType<typeof occ>[]) =>
    provider.push({ calendars: [{ id: 'cal-work', name: 'Work' }], occurrences: o })

  it('rolls the expansion window: from the start of yesterday, 15 days ahead', () => {
    svc.start()
    const w = provider.window!
    const d = new Date(T0)
    expect(w.from.getTime()).toBe(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1).getTime())
    expect(w.to.getTime()).toBe(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 15).getTime())
  })

  it('announces once ANNOUNCE_MS before the start, begins once at the start, and skips declined/all-day', () => {
    const starting: string[] = []
    const begun: string[] = []
    svc.onStarting((m) => starting.push(m.title))
    svc.onBegin((m) => begun.push(m.title))
    svc.start()
    snap(
      occ({ summary: 'A', start: at(T0, 5), end: at(T0, 35) }),
      occ({ summary: 'Declined', start: at(T0, 5), end: at(T0, 35), myPartstat: 'DECLINED' }),
      occ({
        summary: 'Day',
        allDay: true,
        startDate: '2026-10-26',
        endDate: null,
        start: at(T0, 5),
        end: at(T0, 5),
      }),
    )
    vi.advanceTimersByTime(5 * 60_000 - ANNOUNCE_MS - 1)
    expect(starting).toEqual([])
    vi.advanceTimersByTime(1)
    expect(starting).toEqual(['A'])
    expect(events.filter((e) => e.data.type === 'meeting.starting')).toHaveLength(1)
    expect(begun).toEqual([])
    vi.advanceTimersByTime(ANNOUNCE_MS)
    expect(begun).toEqual(['A'])
    // a re-snapshot of the same meeting does not fire again
    snap(occ({ summary: 'A', start: at(T0, 5), end: at(T0, 35) }))
    vi.advanceTimersByTime(60 * 60_000)
    expect(starting).toEqual(['A'])
    expect(begun).toEqual(['A'])
  })

  it('never fires `begin` late for meetings already under way at the first snapshot', () => {
    const begun: string[] = []
    svc.onBegin((m) => begun.push(m.title))
    svc.start()
    snap(occ({ summary: 'Under way', start: at(T0, -1), end: at(T0, 30) }))
    vi.advanceTimersByTime(10_000)
    expect(begun).toEqual([])
  })

  it('a later snapshot revealing a meeting that just started (within the grace) still begins it', () => {
    const begun: string[] = []
    svc.onBegin((m) => begun.push(m.title))
    svc.start()
    snap()
    vi.advanceTimersByTime(60_000)
    snap(
      occ({
        summary: 'Just added',
        start: new Date(Date.now() - 2_000).toISOString(),
        end: at(Date.now(), 30),
      }),
    )
    expect(begun).toEqual(['Just added'])
    snap(
      occ({
        summary: 'Just added',
        start: new Date(Date.now() - 2_000).toISOString(),
        end: at(Date.now(), 30),
      }),
      occ({ summary: 'Long gone', start: at(Date.now(), -20), end: at(Date.now(), 30) }),
    )
    expect(begun).toEqual(['Just added'])
  })

  it('notifies change listeners when a meeting starts and when it ends (current changes)', () => {
    let changes = 0
    svc.onChange(() => changes++)
    svc.start()
    snap(occ({ summary: 'A', start: at(T0, 1), end: at(T0, 2) }))
    const after = changes
    vi.advanceTimersByTime(60_000)
    expect(changes).toBeGreaterThan(after) // began
    const began = changes
    vi.advanceTimersByTime(60_000)
    expect(changes).toBeGreaterThan(began) // ended
    expect(svc.next()).toMatchObject({ current: null, next: null })
  })

  it('publishes calendar.updated on snapshots and state changes, with the status', async () => {
    svc.start()
    provider.state('unavailable', 'EDS is not running')
    expect(svc.status()).toMatchObject({
      state: 'unavailable',
      detail: 'EDS is not running',
      provider: 'manual',
    })
    snap(occ({ summary: 'A', start: at(T0, 60), end: at(T0, 90) }))
    provider.state('ok')
    const updates = events.filter((e) => e.data.type === 'calendar.updated')
    expect(updates.length).toBeGreaterThanOrEqual(3)
    expect(svc.status().updatedAt).toBe(new Date(T0).toISOString())
    expect((await svc.list(new Date(T0), new Date(T0 + 3600_000 * 2))).meetings.map((m) => m.title)).toEqual([
      'A',
    ])
  })

  it('a query outside the window widens it and waits for the re-expanded snapshot', async () => {
    const wide = new ManualCalendarProvider({ expands: true })
    const s2 = new CalendarService({
      provider: wide,
      bus,
      logger: new Logger(),
      now: () => new Date(Date.now()),
    })
    s2.start()
    const before = wide.window!
    const far = { from: new Date(T0 + 40 * 86_400_000), to: new Date(T0 + 41 * 86_400_000) }
    const pending = s2.list(far.from, far.to)
    expect(wide.window!.from).toEqual(before.from)
    expect(wide.window!.to).toEqual(far.to)
    wide.push({
      calendars: [],
      occurrences: [occ({ summary: 'Far', start: at(T0, 40 * 1440 + 60), end: at(T0, 40 * 1440 + 90) })],
    })
    expect((await pending).meetings.map((m) => m.title)).toEqual(['Far'])
    // inside the (now wider) window: no new expansion
    const setWindow = vi.spyOn(wide, 'setWindow')
    await s2.list(far.from, far.to)
    expect(setWindow).not.toHaveBeenCalled()
    await expect(s2.list(new Date(T0), new Date(T0 + 400 * 86_400_000))).rejects.toMatchObject({
      code: 'bad_request',
    })
    await s2.stop()
  })
})

describe('otherMicUsers (pw-dump)', () => {
  const node = (id: number, props: Record<string, unknown>, state = 'running') => ({
    id,
    type: 'PipeWire:Interface:Node',
    info: { state, props },
  })
  it('finds other applications capturing from a microphone, and nothing else', () => {
    const dump = [
      node(40, { 'media.class': 'Audio/Source', 'node.name': 'alsa_input.usb' }),
      node(41, { 'media.class': 'Stream/Input/Audio', 'node.name': 'gnomeola-capture-mic' }),
      node(42, {
        'media.class': 'Stream/Input/Audio',
        'application.name': 'Firefox',
        'application.process.id': 4242,
      }),
      node(43, {
        'media.class': 'Stream/Input/Audio',
        'application.name': 'OBS',
        'stream.capture.sink': 'true',
      }),
      node(44, {
        'media.class': 'Stream/Input/Audio',
        'application.name': 'Settings',
        'stream.monitor': true,
      }),
      node(45, { 'media.class': 'Stream/Input/Audio', 'application.name': 'Zoom' }, 'idle'),
      node(46, { 'media.class': 'Stream/Output/Audio', 'application.name': 'Spotify' }),
      node(47, { 'media.class': 'Stream/Input/Audio', 'application.process.binary': 'teams' }),
      { id: 1, type: 'PipeWire:Interface:Client', info: { props: {} } },
    ]
    expect(otherMicUsers(dump)).toEqual([
      { id: 42, app: 'Firefox', pid: 4242 },
      { id: 47, app: 'teams', pid: null },
    ])
    expect(otherMicUsers({})).toEqual([])
    const aimed = [
      node(50, { 'media.class': 'Stream/Input/Audio', 'application.name': 'A', 'target.object': 'rig-mic' }),
      node(51, { 'media.class': 'Stream/Input/Audio', 'application.name': 'B', 'target.object': 'yeti' }),
    ]
    expect(otherMicUsers(aimed, { onlyTarget: 'rig-mic' }).map((u) => u.app)).toEqual(['A'])
  })
})
