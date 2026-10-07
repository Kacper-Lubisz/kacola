import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, type Session } from '@kacola/protocol'
import { waitFor } from '@kacola/testkit/daemon'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ManualCalendarProvider } from '../src/calendar/providers.ts'
import { createDaemon, type Daemon } from '../src/daemon.ts'
import { changedProps, clipLine, dbusView, PRIVATE_TITLE } from '../src/dbus/view.ts'
import { FakePipeline } from '../src/fakes/pipeline.ts'
import { MemoryKeyring } from '../src/keyring.ts'
import { ManualMicActivity } from '../src/mic-activity.ts'
import { at, occ } from './calendar-helpers.ts'

// C-8 auto-record rules and the RecordingControl verbs, against an in-process daemon with a scripted
// calendar and a scripted microphone-activity source.

let dir: string
let d: Daemon
let cal: ManualCalendarProvider
let mic: ManualMicActivity

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'kacola-autorec-'))
  cal = new ManualCalendarProvider()
  mic = new ManualMicActivity()
  d = await createDaemon({
    dataDir: dir,
    port: 0,
    pipeline: new FakePipeline({ segmentEveryMs: 50, partialEveryMs: 20 }),
    keyring: new MemoryKeyring(),
    env: {},
    calendar: cal,
    micActivity: mic,
    micIdleStopMs: 300,
  })
})
afterEach(async () => {
  await d.close()
  rmSync(dir, { recursive: true, force: true })
})

const live = () => d.store.sessionsWithStatus(['recording', 'paused'])
const snap = (...o: ReturnType<typeof occ>[]) =>
  cal.push({ calendars: [{ id: 'cal-work', name: 'Work' }], occurrences: o })

describe('calendar rule', () => {
  it('is off by default: a meeting starting records nothing', async () => {
    snap(
      occ({ summary: 'Standup', start: new Date(Date.now() + 300).toISOString(), end: at(Date.now(), 15) }),
    )
    await new Promise((r) => setTimeout(r, 700))
    expect(live()).toEqual([])
  })

  it('records a meeting at its start, titled and linked, with reason `calendar`', async () => {
    await d.settings.patch({ autoRecord: { calendar: true } })
    snap(
      occ({
        summary: 'Standup',
        start: new Date(Date.now() + 400).toISOString(),
        end: at(Date.now(), 15),
        location: 'https://meet.google.com/abc-defg-hij',
      }),
    )
    expect(live()).toEqual([])
    const [s] = await waitFor(() => (live().length ? live() : null), 3000, 'auto-recorded session')
    expect(s).toMatchObject({
      title: 'Standup',
      status: 'recording',
      meeting: { title: 'Standup', join: { provider: 'meet' } },
    })
    expect(d.control.reason(s!.id)).toBe('calendar')
  })

  it('never interrupts a recording already running', async () => {
    await d.settings.patch({ autoRecord: { calendar: true } })
    const manual = await d.control.startNew({ title: 'Manual', reason: 'manual' })
    snap(
      occ({ summary: 'Standup', start: new Date(Date.now() + 200).toISOString(), end: at(Date.now(), 15) }),
    )
    await new Promise((r) => setTimeout(r, 600))
    expect(live().map((s) => s.id)).toEqual([manual.id])
  })
})

describe('microphone rule', () => {
  it('watches only while enabled', async () => {
    expect(mic.running).toBe(false)
    await d.settings.patch({ autoRecord: { micActivity: true } })
    expect(mic.running).toBe(true)
    await d.settings.patch({ autoRecord: { micActivity: false } })
    expect(mic.running).toBe(false)
  })

  it('records when another app opens the mic, and stops after it has been idle', async () => {
    await d.settings.patch({ autoRecord: { micActivity: true } })
    mic.set([{ id: 42, app: 'Firefox', pid: 1 }])
    const [s] = await waitFor(() => (live().length ? live() : null), 3000, 'mic-triggered session')
    expect(s!.title).toBe('Call (Firefox)')
    expect(d.control.reason(s!.id)).toBe('mic-activity')
    mic.set([])
    await waitFor(() => d.store.getSession(s!.id)?.status === 'stopped', 3000, 'auto stop')
  })

  it('a mic that comes back within the idle period keeps the same recording', async () => {
    await d.settings.patch({ autoRecord: { micActivity: true } })
    mic.set([{ id: 42, app: 'Zoom', pid: 1 }])
    const [s] = await waitFor(() => (live().length ? live() : null), 3000, 'session')
    mic.set([])
    await new Promise((r) => setTimeout(r, 100))
    mic.set([{ id: 43, app: 'Zoom', pid: 1 }])
    await new Promise((r) => setTimeout(r, 500))
    expect(live().map((x) => x.id)).toEqual([s!.id])
  })

  it('links the calendar meeting in progress, and never stops a recording it did not start', async () => {
    snap(occ({ summary: 'Design review', start: at(Date.now(), -5), end: at(Date.now(), 25) }))
    await d.settings.patch({ autoRecord: { micActivity: true } })
    mic.set([{ id: 42, app: 'Firefox', pid: 1 }])
    const [s] = await waitFor(() => (live().length ? live() : null), 3000, 'session')
    expect(s).toMatchObject({ title: 'Design review', meeting: { title: 'Design review' } })
    // the user stops it and starts their own; the rule must leave that one alone
    await d.control.stopActive()
    const own = await d.control.startNew({ title: 'Mine', reason: 'manual' })
    mic.set([])
    await new Promise((r) => setTimeout(r, 600))
    expect(d.store.getSession(own.id)?.status).toBe('recording')
  })
})

describe('M4 × M7: the calendar event picks the notes template', () => {
  it('a session recorded for a meeting suggests the template its calendar title calls for', async () => {
    snap(occ({ summary: 'Interview: Jo Bloggs', start: at(Date.now(), 30), end: at(Date.now(), 60) }))
    const { next } = d.calendar.next()
    const { session } = await d.control.join(next!.id)
    // renamed to something generic in the window: the calendar title still decides
    d.store.updateSession(session.id, (s) => ({ ...s, title: 'Daily standup' }))
    const c = createClient({ baseUrl: d.url })
    const r = await c.call('listTemplates', { query: { sessionId: session.id } })
    expect(r.suggested).toMatchObject({ templateId: 'interview', matched: { source: 'calendar' } })
    // an explicit calendarTitle from the caller still wins
    const explicit = await c.call('listTemplates', {
      query: { sessionId: session.id, calendarTitle: 'Budget review' },
    })
    expect(explicit.suggested).toMatchObject({ templateId: 'standup', matched: { source: 'session' } })
  })
})

describe('RecordingControl', () => {
  it('refuses a second recording, and join of an unknown meeting', async () => {
    await d.control.startNew({ title: 'One', reason: 'manual' })
    await expect(d.control.startNew({ title: 'Two', reason: 'manual' })).rejects.toMatchObject({
      code: 'conflict',
    })
    await expect(d.control.join('mtg_nope')).rejects.toMatchObject({ code: 'not_found' })
  })
  it('pauses, resumes and stops THE active session; errors when there is none', async () => {
    await expect(d.control.stopActive()).rejects.toMatchObject({ code: 'conflict' })
    const s = await d.control.startNew({ reason: 'manual' })
    expect((await d.control.pauseActive()).status).toBe('paused')
    expect((await d.control.resumeActive()).status).toBe('recording')
    expect((await d.control.stopActive()).id).toBe(s.id)
  })
})

describe('D-Bus view', () => {
  const base = {
    timing: null,
    lastLine: null,
    current: null,
    next: null,
    upcoming: [],
    calendar: { state: 'ok' as const, provider: 'eds', detail: null, calendars: [], updatedAt: null },
    autoRecord: { calendar: true, micActivity: false },
    url: 'http://127.0.0.1:8787',
    version: '0.1.0',
  }
  const session = (o: Partial<Session>): Session => ({
    id: 'ses_1',
    title: 'Board meeting',
    createdAt: '2026-10-26T08:00:00.000Z',
    startedAt: '2026-10-26T08:00:00.000Z',
    endedAt: null,
    status: 'recording',
    private: false,
    durationMs: 0,
    tracks: [],
    error: null,
    ...o,
  })

  it('idle', () => {
    expect(dbusView({ ...base, session: null })).toMatchObject({
      State: 'idle',
      SessionId: '',
      ElapsedMs: 0,
      RunningSince: 0,
      CurrentMeeting: {},
      NextMeeting: {},
      AutoRecord: ['calendar'],
      CalendarState: 'ok',
    })
  })
  it('recording with elapsed and the last line; paused has no RunningSince', () => {
    const v = dbusView({
      ...base,
      session: session({}),
      timing: { accumulatedMs: 5000, runningSince: 1_700_000_000_000 },
      lastLine: { speaker: 'them', text: '  hello\n world ' },
    })
    expect(v).toMatchObject({
      State: 'recording',
      SessionTitle: 'Board meeting',
      ElapsedMs: 5000,
      RunningSince: 1_700_000_000_000,
      LastLine: 'hello world',
      LastSpeaker: 'them',
    })
    expect(
      dbusView({ ...base, session: session({ status: 'paused', durationMs: 7000 }), timing: null }),
    ).toMatchObject({
      State: 'paused',
      ElapsedMs: 7000,
      RunningSince: 0,
    })
  })
  it('a private session is visible as recording, but not its title or words', () => {
    const v = dbusView({
      ...base,
      session: session({ private: true }),
      lastLine: { speaker: 'me', text: 'salary' },
    })
    expect(v).toMatchObject({
      State: 'recording',
      SessionTitle: PRIVATE_TITLE,
      LastLine: '',
      LastSpeaker: '',
    })
  })
  it('a stopped session is idle', () => {
    expect(dbusView({ ...base, session: session({ status: 'stopped' }) }).State).toBe('idle')
  })
  it('clips long lines from the front, on a word boundary', () => {
    const long = `${'word '.repeat(60)}the end`
    const c = clipLine(long, 40)
    expect(c.length).toBeLessThanOrEqual(40)
    expect(c.startsWith('…')).toBe(true)
    expect(c.endsWith('the end')).toBe(true)
  })
  it('changedProps is a deep diff', () => {
    const a = dbusView({ ...base, session: null })
    expect(changedProps(a, a)).toEqual({})
    expect(changedProps({}, a)).toEqual(a)
    expect(Object.keys(changedProps(a, { ...a, AutoRecord: [] }))).toEqual(['AutoRecord'])
  })
})
