import { type ChildProcess, spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import {
  type EdsHandle,
  EXPECTED,
  type ExpectedOccurrence,
  LINKS,
  startEds,
  WINDOW,
} from '@gnomeola/testkit/eds'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AgentMessage, CAL_AGENT_PROTOCOL, type RawOccurrence } from '../src/calendar/agent-protocol.ts'

// V-4c: the real cal-agent (GJS + ECal) against a real, isolated Evolution Data Server seeded with the
// testkit calendar fixtures. Every occurrence in the window is asserted exactly — nothing missed, nothing
// extra, nothing an hour off across either DST boundary — plus live change detection.

const AGENT = join(import.meta.dirname, '..', 'gjs', 'cal-agent.js')
type Snapshot = Extract<AgentMessage, { type: 'snapshot' }>

class Agent {
  readonly child: ChildProcess
  readonly messages: AgentMessage[] = []
  readonly invalid: string[] = []
  private waiters: (() => void)[] = []
  stderr = ''

  constructor(env: Record<string, string>) {
    this.child = spawn('gjs', ['-m', AGENT], { env, stdio: ['pipe', 'pipe', 'pipe'] })
    this.child.stdin!.on('error', () => {}) // EPIPE once it has exited
    this.child.stderr!.on('data', (d: Buffer) => {
      this.stderr += d.toString()
    })
    createInterface({ input: this.child.stdout! }).on('line', (line) => {
      const parsed = AgentMessage.safeParse(JSON.parse(line))
      if (parsed.success) this.messages.push(parsed.data)
      else this.invalid.push(`${line.slice(0, 300)} → ${parsed.error.message}`)
      for (const w of this.waiters.splice(0)) w()
    })
  }

  send(msg: unknown) {
    this.child.stdin!.write(`${JSON.stringify(msg)}\n`)
  }

  snapshots(): Snapshot[] {
    return this.messages.filter((m): m is Snapshot => m.type === 'snapshot')
  }

  /** Resolve with the first snapshot after index `after` that satisfies `pred`. */
  async nextSnapshot(after: number, pred: (s: Snapshot) => boolean = () => true, timeoutMs = 15_000) {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const hit = this.snapshots().slice(after).find(pred)
      if (hit) return hit
      if (Date.now() > deadline)
        throw new Error(
          `no matching snapshot within ${timeoutMs} ms (exit ${this.child.exitCode}/${this.child.signalCode})\n${this.invalid.join('\n').slice(0, 3000)}\n${this.stderr}\n${JSON.stringify(this.messages.at(-1)).slice(0, 500)}`,
        )
      await new Promise<void>((r) => {
        this.waiters.push(r)
        setTimeout(r, 200)
      })
    }
  }

  async end(): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
    const c = this.child
    if (c.exitCode !== null || c.signalCode !== null) return { code: c.exitCode, signal: c.signalCode }
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((r) =>
      this.child.once('exit', (code, signal) => r({ code, signal })),
    )
    this.child.stdin!.end()
    return exited
  }
}

/** The fields the fixtures pin down, from what the agent reported. */
function project(o: RawOccurrence, e: ExpectedOccurrence) {
  const out: Record<string, unknown> = {
    sourceUid: o.sourceUid,
    uid: o.uid,
    recurrenceId: o.recurrenceId,
    summary: o.summary,
    start: o.allDay ? null : o.start,
    end: o.allDay ? null : o.end,
    allDay: o.allDay,
    startDate: o.startDate,
    endDate: o.endDate,
    timezone: o.timezone,
    status: o.status,
    myPartstat: o.myPartstat,
    attendees: o.attendees,
    recurring: o.recurring,
  }
  for (const k of ['location', 'description', 'url', 'xprops', 'organizer'] as const)
    if (k in e) out[k] = o[k]
  return out
}

const key = (o: { uid: string; allDay: boolean; start: string | null; startDate: string | null }) =>
  `${o.uid} @ ${o.allDay ? o.startDate : o.start}`

let eds: EdsHandle
let agent: Agent
let first: Snapshot

beforeAll(async () => {
  eds = await startEds()
  agent = new Agent(eds.env)
  agent.send({ type: 'window', ...WINDOW })
  try {
    first = await agent.nextSnapshot(0)
  } catch (err) {
    throw new Error(
      `${(err as Error).message}\nEDS logs: ${JSON.stringify(eds.logs(), null, 1).slice(-6000)}`,
    )
  }
}, 120_000)

afterAll(async () => {
  if (agent && agent.child.exitCode === null) agent.child.kill('SIGKILL')
  const r = await eds?.close()
  expect(r?.killedStragglers ?? []).toEqual([])
})

describe('cal-agent against seeded EDS', () => {
  it('says hello with the protocol version, and every line matches the schema', () => {
    expect(agent.messages[0]).toMatchObject({ type: 'hello', protocol: CAL_AGENT_PROTOCOL })
    expect(agent.invalid).toEqual([])
  })

  it('lists the enabled calendars and never the disabled one', () => {
    const ids = first.calendars.map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining(['gnomeola-work', 'gnomeola-personal']))
    expect(ids).not.toContain('gnomeola-disabled')
    expect(first.calendars.find((c) => c.id === 'gnomeola-personal')?.name).toBe('Personal things')
    expect(first.occurrences.some((o) => o.uid === 'hidden@test')).toBe(false)
  })

  it('reports every occurrence in the window exactly: none missed, none extra, none mis-timed', () => {
    const got = first.occurrences.filter((o) => o.sourceUid.startsWith('gnomeola-'))
    const byKey = new Map(got.map((o) => [key(o), o]))
    // same set of occurrences…
    expect([...byKey.keys()].sort()).toEqual(EXPECTED.map(key).sort())
    expect(got).toHaveLength(EXPECTED.length)
    // …and each one right in every pinned field
    for (const e of EXPECTED) expect(project(byKey.get(key(e))!, e), key(e)).toEqual(e)
    // sorted by start
    const starts = first.occurrences.map((o) => o.start)
    expect(starts).toEqual([...starts].sort())
  })

  it('keeps wall-clock time across the EU and US DST ends', () => {
    const at = (uid: string) =>
      first.occurrences.filter((o) => o.uid === uid).map((o) => o.start.slice(11, 16))
    expect(at('standup-warsaw@test')).toEqual(['07:00', '08:00', '08:00', '08:00'])
    expect(at('ny-sync@test')).toEqual(['14:00', '15:00'])
    for (const o of first.occurrences.filter((o) => o.uid === 'standup-warsaw@test')) {
      const local = new Date(o.start).toLocaleTimeString('en-GB', { timeZone: 'Europe/Warsaw' })
      expect(local).toBe('09:00:00')
    }
  })

  it('carries every join-link shape through untouched for the daemon to extract', () => {
    const one = (uid: string) => first.occurrences.find((o) => o.uid === uid)!
    expect(one('standup-warsaw@test').location).toBe(LINKS.meet)
    expect(one('ny-sync@test').description).toBe(LINKS.zoomHtml)
    expect(one('utc-review@test').description).toContain(`<${LINKS.teamsUrl}>`)
    expect(one('utc-review@test').description).toContain('computer, mobile app')
    expect(one('utc-review@test').xprops).toEqual({ 'X-MICROSOFT-SKYPETEAMSMEETINGURL': LINKS.teamsUrl })
    expect(one('google-conf@test').xprops).toEqual({ 'X-GOOGLE-CONFERENCE': LINKS.googleConference })
    expect(one('webex@test').url).toBe(LINKS.webex)
  })
})

describe('change detection', () => {
  it('re-snapshots after an event is added, modified and removed', async () => {
    let n = agent.snapshots().length
    await eds.createEvent(
      'gnomeola-work',
      [
        'BEGIN:VEVENT',
        'UID:added-live@test',
        'DTSTAMP:20261001T000000Z',
        'SUMMARY:Added live',
        'DTSTART:20261030T100000Z',
        'DTEND:20261030T110000Z',
        'LOCATION:https://zoom.us/j/99999999999',
        'END:VEVENT',
      ].join('\n'),
    )
    const added = await agent.nextSnapshot(n, (s) => s.occurrences.some((o) => o.uid === 'added-live@test'))
    expect(added.occurrences.find((o) => o.uid === 'added-live@test')).toMatchObject({
      start: '2026-10-30T10:00:00.000Z',
      location: 'https://zoom.us/j/99999999999',
    })

    n = agent.snapshots().length
    await eds.modifyEvent(
      'gnomeola-work',
      [
        'BEGIN:VEVENT',
        'UID:added-live@test',
        'DTSTAMP:20261001T000000Z',
        'SUMMARY:Moved live',
        'DTSTART:20261030T120000Z',
        'DTEND:20261030T130000Z',
        'END:VEVENT',
      ].join('\n'),
    )
    const moved = await agent.nextSnapshot(n, (s) =>
      s.occurrences.some((o) => o.uid === 'added-live@test' && o.summary === 'Moved live'),
    )
    expect(moved.occurrences.filter((o) => o.uid === 'added-live@test')).toMatchObject([
      { start: '2026-10-30T12:00:00.000Z', summary: 'Moved live' },
    ])

    n = agent.snapshots().length
    await eds.removeEvent('gnomeola-work', 'added-live@test')
    const removed = await agent.nextSnapshot(
      n,
      (s) => !s.occurrences.some((o) => o.uid === 'added-live@test'),
    )
    expect(removed.occurrences.filter((o) => o.sourceUid.startsWith('gnomeola-'))).toHaveLength(
      EXPECTED.length,
    )
  })

  it('drops a calendar that gets disabled and picks it up again when re-enabled', async () => {
    let n = agent.snapshots().length
    await eds.setEnabled('gnomeola-personal', false)
    const off = await agent.nextSnapshot(n, (s) => !s.calendars.some((c) => c.id === 'gnomeola-personal'))
    expect(off.occurrences.some((o) => o.uid === 'dentist@test')).toBe(false)
    n = agent.snapshots().length
    await eds.setEnabled('gnomeola-personal', true)
    const on = await agent.nextSnapshot(n, (s) => s.occurrences.some((o) => o.uid === 'dentist@test'))
    expect(on.calendars.map((c) => c.id)).toContain('gnomeola-personal')
  })

  it('answers a new window with a fresh snapshot of just that range, and refresh with another', async () => {
    let n = agent.snapshots().length
    agent.send({ type: 'window', from: '2026-10-19T06:00:00.000Z', to: '2026-10-19T12:00:00.000Z' })
    const day = await agent.nextSnapshot(n, (s) => s.from === '2026-10-19T06:00:00.000Z')
    expect(day.occurrences.map((o) => o.uid)).toEqual(['standup-warsaw@test'])
    n = agent.snapshots().length
    agent.send({ type: 'refresh' })
    const again = await agent.nextSnapshot(n)
    expect(again.occurrences.map((o) => o.uid)).toEqual(['standup-warsaw@test'])
    agent.send({ type: 'nonsense' })
    agent.child.stdin!.write('not json\n')
  })

  it('exits 0 on stdin EOF, without crashing on teardown', async () => {
    expect(await agent.end()).toEqual({ code: 0, signal: null })
    expect(agent.invalid).toEqual([])
    expect(agent.messages.filter((m) => m.type === 'error')).toEqual([])
  })
})

describe('failure modes', () => {
  it('is fatal (error line, exit 1) when there is no source registry to reach', async () => {
    // a session bus address with nothing listening: EDS is unreachable
    const dir = mkdtempSync(join(tmpdir(), 'gnomeola-noeds-'))
    try {
      const env = { ...eds.env, DBUS_SESSION_BUS_ADDRESS: `unix:path=${join(dir, 'nobody')}` }
      const a = new Agent(env)
      const r = await new Promise((res) => a.child.once('exit', (code) => res(code)))
      expect(r).toBe(1)
      expect(a.messages[0]).toMatchObject({ type: 'hello' })
      expect(a.messages.find((m) => m.type === 'error')).toMatchObject({ fatal: true })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
