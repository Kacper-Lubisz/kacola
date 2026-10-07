import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, LEGACY_APP_ID, LEGACY_OBJECT_PATH } from '@kacola/protocol'
import { DbusCallError, DbusProbe, type PrivateBus, startPrivateBus } from '@kacola/testkit/dbus'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ManualCalendarProvider } from '../src/calendar/providers.ts'
import { createDaemon, type Daemon } from '../src/daemon.ts'
import { BUS_NAME, INTERFACE, OBJECT_PATH } from '../src/dbus/bridge-protocol.ts'
import { INTERFACE_XML } from '../src/dbus/service.ts'
import { FakePipeline } from '../src/fakes/pipeline.ts'
import { MemoryKeyring } from '../src/keyring.ts'
import { at, occ } from './calendar-helpers.ts'

// V-4a: the com.kacperlubisz.Kacola contract against a REAL (private) session bus — a real dbus-daemon, the
// real GJS bridge, the real daemon — observed through a Gio.DBusProxy exactly as the Shell extension
// sees it. Every property, method and signal, including each state the extension has to render.

let bus: PrivateBus
let dir: string
let d: Daemon
let cal: ManualCalendarProvider
let probe: DbusProbe

async function daemonOn(address: string, calendar = new ManualCalendarProvider()) {
  const dataDir = mkdtempSync(join(tmpdir(), 'kacola-dbus-'))
  const daemon = await createDaemon({
    dataDir,
    port: 0,
    pipeline: new FakePipeline({ segmentEveryMs: 80, partialEveryMs: 30 }),
    keyring: new MemoryKeyring(),
    env: {},
    calendar,
    dbus: { env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: address }, minBackoffMs: 100 },
  })
  return { daemon, dataDir }
}

beforeAll(async () => {
  bus = await startPrivateBus()
  expect(bus.address).toContain(bus.dir) // never the user's bus
  cal = new ManualCalendarProvider()
  const r = await daemonOn(bus.address, cal)
  d = r.daemon
  dir = r.dataDir
  probe = new DbusProbe({ address: bus.address, name: BUS_NAME, path: OBJECT_PATH, iface: INTERFACE })
  await probe.until((p) => p.DaemonUrl === d.url, 15_000, 'the bridge to own the name and publish')
})
afterAll(async () => {
  await probe?.close()
  await d?.close()
  await bus?.close()
  rmSync(dir, { recursive: true, force: true })
})

/** The interface's members as normalised tokens: attribute order and formatting do not matter. */
const members = (xml: string): string[] => {
  const from = xml.indexOf(`<interface name="${INTERFACE}"`)
  const body = xml.slice(from, xml.indexOf('</interface>', from))
  let inSignal = false
  return (
    [...body.matchAll(/<(method|signal|property|arg)\b([^>]*)>/g)]
      .map(([, tag, attrs]) => {
        const a = Object.fromEntries([...attrs!.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]))
        if (tag === 'method' || tag === 'property') inSignal = false
        if (tag === 'signal') inSignal = true
        if (tag === 'arg') return `arg ${a.name} ${a.type}${inSignal ? '' : ` ${a.direction ?? 'in'}`}`
        return `\n${tag} ${a.name}${a.type ? ` ${a.type} ${a.access}` : ''}`
      })
      // one block per member with its args in order; member order does not matter (GDBus groups them)
      .join(' | ')
      .split('\n')
      .map((b) => b.replace(/^ \| | \| $/g, '').trim())
      .filter(Boolean)
      .sort()
  )
}

describe('introspection', () => {
  it('exports exactly the interface in the XML contract', async () => {
    const live = await probe.introspect()
    const want = readFileSync(INTERFACE_XML, 'utf8').replace(/<!--[\s\S]*?-->/g, '')
    expect(members(want).length).toBe(24) // 16 properties, 5 methods, 3 signals
    expect(members(live)).toEqual(members(want))
    expect(probe.owner).toMatch(/^:1\./)
  })
})

describe('properties: idle, and the calendar states the extension renders', () => {
  it('starts idle with every property present and typed', () => {
    expect(probe.props).toEqual({
      State: 'idle',
      SessionId: '',
      SessionTitle: '',
      SessionMeetingId: '',
      ElapsedMs: 0,
      RunningSince: 0,
      LastLine: '',
      LastSpeaker: '',
      CurrentMeeting: {},
      NextMeeting: {},
      UpcomingMeetings: [],
      CalendarState: 'starting',
      CalendarDetail: '',
      AutoRecord: [],
      DaemonUrl: d.url,
      Version: expect.stringMatching(/^\d+\.\d+\.\d+/),
    })
  })

  it('calendar unavailable → CalendarState/Detail', async () => {
    cal.state('unavailable', 'Evolution Data Server is not running')
    await probe.until((p) => p.CalendarState === 'unavailable')
    expect(probe.props.CalendarDetail).toBe('Evolution Data Server is not running')
  })

  it('meetings → CurrentMeeting, NextMeeting (a{sv}) and UpcomingMeetings (aa{sv})', async () => {
    const now = Date.now()
    cal.push({
      calendars: [{ id: 'cal-work', name: 'Work' }],
      occurrences: [
        occ({
          uid: 'cur',
          summary: 'Design review',
          start: at(now, -10),
          end: at(now, 20),
          location: 'Room 4',
        }),
        occ({
          uid: 'next',
          summary: 'Customer call',
          start: at(now, 30),
          end: at(now, 60),
          description: 'Join Zoom Meeting https://us02web.zoom.us/j/845183022?pwd=abc',
          myPartstat: 'ACCEPTED',
        }),
        occ({
          uid: 'no',
          summary: 'Declined thing',
          start: at(now, 40),
          end: at(now, 50),
          myPartstat: 'DECLINED',
        }),
        occ({
          uid: 'day',
          summary: 'Holiday',
          allDay: true,
          startDate: '2026-10-26',
          start: at(now, 0),
          end: at(now, 0),
        }),
      ],
    })
    cal.state('ok')
    await probe.until(
      (p) => p.CalendarState === 'ok' && (p.NextMeeting as { title?: string }).title === 'Customer call',
    )
    expect(probe.props.CurrentMeeting).toEqual({
      id: expect.stringMatching(/^mtg_/),
      title: 'Design review',
      start: Date.parse(at(now, -10)),
      end: Date.parse(at(now, 20)),
      allDay: false,
      joinUrl: '',
      provider: '',
      calendar: 'Work',
      location: 'Room 4',
      response: '',
    })
    expect(probe.props.NextMeeting).toMatchObject({
      joinUrl: 'https://us02web.zoom.us/j/845183022?pwd=abc',
      provider: 'zoom',
      response: 'accepted',
    })
    expect((probe.props.UpcomingMeetings as { title: string }[]).map((m) => m.title)).toEqual([
      'Design review',
      'Customer call',
    ])
  })

  it('AutoRecord follows the settings', async () => {
    await d.settings.patch({ autoRecord: { calendar: true } })
    await probe.until((p) => JSON.stringify(p.AutoRecord) === '["calendar"]')
    await d.settings.patch({ autoRecord: { calendar: false, micActivity: true } })
    await probe.until((p) => JSON.stringify(p.AutoRecord) === '["micActivity"]')
    await d.settings.patch({ autoRecord: { micActivity: false } })
    await probe.until((p) => JSON.stringify(p.AutoRecord) === '[]')
  })
})

describe('the gnomeola name (one release after the rename)', () => {
  it('an old top-bar extension still finds the daemon at org.gnome.Gnomeola: properties, methods, signals', async () => {
    const old = new DbusProbe({
      address: bus.address,
      name: LEGACY_APP_ID,
      path: LEGACY_OBJECT_PATH,
      iface: LEGACY_APP_ID,
    })
    try {
      await old.until(
        (p) => p.DaemonUrl === d.url && p.State === 'idle',
        15_000,
        'the legacy name to publish',
      )
      const [id] = (await old.call('Start', '(s)', ['Old extension'])) as [string]
      await old.until((x) => x.State === 'recording' && x.SessionId === id)
      await old.waitFor((m) => m.type === 'signal' && m.name === 'SessionStarted')
      expect(old.signals('SessionStarted')).toContainEqual([id, 'Old extension', 'manual'])
      // the same object: the new name saw it too
      await probe.until((x) => x.State === 'recording' && x.SessionId === id)
      expect(await old.call('Stop')).toEqual([id])
      await old.until((x) => x.State === 'idle')
      await probe.until((x) => x.State === 'idle' && x.LastLine === '')
    } finally {
      await old.close()
    }
  })
})

describe('methods and signals', () => {
  it('Start → recording, SessionStarted(reason manual), elapsed anchor and live transcript line', async () => {
    const [id] = (await probe.call('Start', '(s)', ['Quick chat'])) as [string]
    expect(id).toMatch(/^ses_/)
    const p = await probe.until(
      (x) => x.State === 'recording' && x.LastLine !== '',
      10_000,
      'a transcript line',
    )
    expect(p).toMatchObject({ SessionId: id, SessionTitle: 'Quick chat', ElapsedMs: 0 })
    expect(p.RunningSince as number).toBeGreaterThan(Date.now() - 60_000)
    expect(['me', 'them']).toContain(p.LastSpeaker)
    expect(probe.signals('SessionStarted')).toContainEqual([id, 'Quick chat', 'manual'])
    expect((await d.store.getSession(id))?.status).toBe('recording')
  })

  it('Start while recording → com.kacperlubisz.Kacola.Error.Conflict', async () => {
    const err = await probe.call('Start', '(s)', ['Second']).catch((e: DbusCallError) => e)
    expect(err).toBeInstanceOf(DbusCallError)
    expect((err as DbusCallError).dbusName).toBe('com.kacperlubisz.Kacola.Error.Conflict')
    expect((err as DbusCallError).message).toMatch(/already recording "Quick chat"/)
  })

  it('Pause → paused with accumulated ElapsedMs and no RunningSince; Resume → recording again', async () => {
    await new Promise((r) => setTimeout(r, 300))
    await probe.call('Pause')
    const p = await probe.until((x) => x.State === 'paused')
    expect(p.RunningSince).toBe(0)
    expect(p.ElapsedMs as number).toBeGreaterThanOrEqual(250)
    await probe.call('Resume')
    const r = await probe.until((x) => x.State === 'recording')
    expect(r.RunningSince as number).toBeGreaterThan(0)
  })

  it('Stop → idle, SessionStopped(id, stopped); Stop again → Conflict', async () => {
    const id = probe.props.SessionId as string
    expect(await probe.call('Stop')).toEqual([id])
    await probe.until((x) => x.State === 'idle' && x.SessionId === '' && x.LastLine === '')
    await probe.waitFor((m) => m.type === 'signal' && m.name === 'SessionStopped')
    expect(probe.signals('SessionStopped')).toContainEqual([id, 'stopped'])
    await expect(probe.call('Stop')).rejects.toMatchObject({
      dbusName: 'com.kacperlubisz.Kacola.Error.Conflict',
    })
    await expect(probe.call('Pause')).rejects.toMatchObject({
      dbusName: 'com.kacperlubisz.Kacola.Error.Conflict',
    })
  })

  it('Join → (session, join link): records a session linked to and titled after the meeting', async () => {
    const next = probe.props.NextMeeting as { id: string; joinUrl: string }
    const [sid, url] = (await probe.call('Join', '(s)', [next.id])) as [string, string]
    expect(url).toBe(next.joinUrl)
    await probe.until((x) => x.State === 'recording' && x.SessionTitle === 'Customer call')
    expect(probe.props.SessionMeetingId).toBe(next.id)
    expect(probe.signals('SessionStarted')).toContainEqual([sid, 'Customer call', 'join'])
    const s = createClient({ baseUrl: d.url })
    expect(await s.call('getSession', { params: { id: sid } })).toMatchObject({
      title: 'Customer call',
      meeting: { id: next.id, join: { provider: 'zoom' } },
    })
    await probe.call('Stop')
    await probe.until((x) => x.State === 'idle')
  })

  it('Join a meeting without a link records and returns an empty link; an unknown meeting → NotFound', async () => {
    const current = probe.props.CurrentMeeting as { id: string }
    const [, url] = (await probe.call('Join', '(s)', [current.id])) as [string, string]
    expect(url).toBe('')
    await probe.call('Stop')
    await probe.until((x) => x.State === 'idle')
    await expect(probe.call('Join', '(s)', ['mtg_nope'])).rejects.toMatchObject({
      dbusName: 'com.kacperlubisz.Kacola.Error.NotFound',
    })
  })

  it('sessions started elsewhere (the window, over HTTP) are signalled too; private ones are redacted', async () => {
    const c = createClient({ baseUrl: d.url })
    const s = await c.call('createSession', { body: { title: 'HR 1:1', private: true } })
    await c.call('startSession', { params: { id: s.id } })
    await probe.waitFor(
      (m) => m.type === 'signal' && m.name === 'SessionStarted' && (m.args as string[])[0] === s.id,
    )
    expect(probe.signals('SessionStarted')).toContainEqual([s.id, 'Private meeting', 'manual'])
    await probe.until((x) => x.State === 'recording' && x.SessionId === s.id)
    await new Promise((r) => setTimeout(r, 600)) // partials flow; none may reach the bus
    expect(probe.props).toMatchObject({ SessionTitle: 'Private meeting', LastLine: '', LastSpeaker: '' })
    await c.call('stopSession', { params: { id: s.id } })
    await probe.until((x) => x.State === 'idle')
  })

  it('MeetingStarting fires once, a minute ahead, with the meeting', async () => {
    const now = Date.now()
    cal.push({
      calendars: [{ id: 'cal-work', name: 'Work' }],
      occurrences: [
        occ({
          uid: 'soon',
          summary: 'Starts soon',
          start: at(now, 0.75),
          end: at(now, 30),
          location: 'https://meet.google.com/abc-defg-hij',
        }),
      ],
    })
    const m = await probe.waitFor((x) => x.type === 'signal' && x.name === 'MeetingStarting')
    expect((m as { args: unknown[] }).args[0]).toMatchObject({
      title: 'Starts soon',
      joinUrl: 'https://meet.google.com/abc-defg-hij',
      provider: 'meet',
    })
    cal.push({
      calendars: [],
      occurrences: [occ({ uid: 'soon', summary: 'Starts soon', start: at(now, 0.75), end: at(now, 30) })],
    })
    await new Promise((r) => setTimeout(r, 300))
    expect(probe.signals('MeetingStarting')).toHaveLength(1)
  })
})

describe('lifetime', () => {
  it('a crashed bridge is restarted and republishes everything', async () => {
    const pid = d.dbus!.bridgePid!
    const mark = probe.mark()
    process.kill(pid, 'SIGKILL')
    await probe.waitFor((m) => m.type === 'owner' && m.owner === null, 5000, 'the name to vanish', mark)
    await probe.until((p) => p.DaemonUrl === d.url && probe.owner !== null, 10_000, 'the name to come back')
    expect(d.dbus!.bridgePid).not.toBe(pid)
    expect(probe.props.CalendarState).toBe('ok')
  })

  it('a second daemon on the same bus queues for the name instead of stealing it, and takes over on exit', async () => {
    const second = await daemonOn(bus.address)
    try {
      await new Promise((r) => setTimeout(r, 1000))
      expect(d.dbus!.ownsName).toBe(true)
      expect(second.daemon.dbus!.ownsName).toBe(false)
      expect(probe.props.DaemonUrl).toBe(d.url)
      await d.close()
      await probe.until((p) => p.DaemonUrl === second.daemon.url, 10_000, 'the second daemon to take over')
      expect(second.daemon.dbus!.ownsName).toBe(true)
    } finally {
      const mark = probe.mark()
      await second.daemon.close()
      rmSync(second.dataDir, { recursive: true, force: true })
      await probe.waitFor(
        (m) => m.type === 'owner' && m.owner === null,
        5000,
        'the name released on shutdown',
        mark,
      )
    }
  })
})
